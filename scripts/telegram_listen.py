#!/usr/bin/env python3
"""Watch what the bot receives, and print the chat id of every message.

The reliable way to learn a chat id: leave this running, then send something —
to the bot directly, in the group, or in the channel — and read the id off the
line that appears.

    scripts/telegram_listen.py            # wait for new messages
    scripts/telegram_listen.py --history  # show what is already queued, then wait
    scripts/telegram_listen.py --once     # stop after the first chat it sees

Ctrl-C to stop. The token comes from ``--token``, the environment, or the
repository's ``.env``.

Two things worth knowing about what this does. It **consumes** updates: Telegram
holds an update until something acknowledges it, and acknowledging is how long
polling advances, so an update printed here is gone from the queue afterwards.
And a chat only reaches a bot at all when the bot can see it — a direct message
always arrives, a channel post only once the bot is an administrator there.

Standard library only, so a bare python3 anywhere can run it.
"""

import argparse
import json
import ssl
import sys
import urllib.error
import urllib.parse
import urllib.request

from telegram_check import env_or_dotenv  # same directory, same conventions

API_ROOT = "https://api.telegram.org"
# Telegram holds the request open this long waiting for something to happen, so
# the loop is one call a half minute rather than a poll every second.
LONG_POLL = 25
TIMEOUT = LONG_POLL + 10

# The update kinds that carry a chat. `my_chat_member` is the one that fires when
# the bot is added to a channel, which is often the very first thing it sees.
CHAT_BEARING = (
    "message",
    "edited_message",
    "channel_post",
    "edited_channel_post",
    "my_chat_member",
    "chat_member",
)


def _explain_conflict(token: str) -> str:
    """Which of the two things a 409 means, asked rather than guessed.

    Telegram gives one bot one reader. A conflict is either a webhook holding the
    updates, or a second poller — often this same script, still running in another
    terminal — and the fix is different for each, so it is worth finding out.
    """
    url = f"{API_ROOT}/bot{token}/getWebhookInfo"
    try:
        with urllib.request.urlopen(
            url, timeout=10, context=ssl.create_default_context()
        ) as response:
            hook = json.load(response).get("result", {}).get("url", "")
    except (urllib.error.URLError, json.JSONDecodeError, KeyError):
        return "Either a webhook is set on this bot, or something else is polling it."
    if hook:
        return (
            f"A webhook is set ({hook}), and a webhook takes the updates instead. "
            "Delete it with getUpdates' opposite, deleteWebhook, to poll."
        )
    return (
        "No webhook, so something else is polling this bot — most often this "
        "script already running in another terminal. Stop that one first "
        "(`pgrep -fl telegram_listen.py`)."
    )


def get_updates(token: str, offset: int | None, timeout: int) -> list[dict]:
    """One long poll. Raises RuntimeError with whatever Telegram said."""
    params = {"timeout": timeout, "limit": 100}
    if offset is not None:
        params["offset"] = offset
    url = f"{API_ROOT}/bot{token}/getUpdates?{urllib.parse.urlencode(params)}"
    try:
        with urllib.request.urlopen(
            url, timeout=TIMEOUT, context=ssl.create_default_context()
        ) as response:
            return json.load(response).get("result", [])
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", "replace")
        try:
            described = json.loads(body).get("description", body)
        except json.JSONDecodeError:
            described = body
        if exc.code == 409:
            described += "\n  " + _explain_conflict(token)
        raise RuntimeError(f"getUpdates: HTTP {exc.code}: {described}") from None
    except urllib.error.URLError as exc:
        raise RuntimeError(
            f"getUpdates: could not reach Telegram: {exc.reason}"
        ) from None


def describe(update: dict) -> tuple[str, str] | None:
    """(chat id, one line about it) for an update that carries a chat."""
    for kind in CHAT_BEARING:
        payload = update.get(kind)
        if not payload:
            continue
        chat = payload.get("chat")
        if not chat:
            continue
        title = (
            chat.get("title")
            or " ".join(filter(None, [chat.get("first_name"), chat.get("last_name")]))
            or chat.get("username")
            or ""
        )
        said = payload.get("text") or payload.get("caption") or f"({kind})"
        said = " ".join(said.split())[:60]
        return str(chat["id"]), f"{chat.get('type', '?'):<10} {title:<28} {said}"
    return None


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Print the chat id of everything the bot receives."
    )
    parser.add_argument("--token", default="", help="bot token; else TELEGRAM_BOT_TOKEN")
    parser.add_argument(
        "--history",
        action="store_true",
        help="also show updates already queued (Telegram keeps them 24h)",
    )
    parser.add_argument(
        "--once", action="store_true", help="stop after the first chat it sees"
    )
    args = parser.parse_args()
    # Long polling means minutes between lines; unbuffered so each one appears
    # when it happens, including through a pipe or a log file.
    sys.stdout.reconfigure(line_buffering=True)

    token = args.token or env_or_dotenv("TELEGRAM_BOT_TOKEN")
    if not token:
        print(
            "No token. Pass --token, set TELEGRAM_BOT_TOKEN, or put it in .env.",
            file=sys.stderr,
        )
        return 2

    offset: int | None = None
    if not args.history:
        # Drain whatever is queued without printing it, so the ids that appear
        # below are the ones being sent right now and nothing older.
        try:
            drained = get_updates(token, None, timeout=0)
        except RuntimeError as exc:
            print(exc, file=sys.stderr)
            return 1
        if drained:
            offset = drained[-1]["update_id"] + 1
            print(f"(skipped {len(drained)} queued update(s); --history shows them)")

    print("Listening. Send a message to the bot, the group or the channel.")
    print("Ctrl-C to stop.\n")
    print(f"{'chat id':<18} {'type':<10} {'name':<28} what was said")
    print("-" * 88)

    seen: set[str] = set()
    while True:
        try:
            updates = get_updates(token, offset, timeout=LONG_POLL)
        except RuntimeError as exc:
            print(exc, file=sys.stderr)
            return 1
        except KeyboardInterrupt:
            break

        for update in updates:
            offset = update["update_id"] + 1
            described = describe(update)
            if described is None:
                continue
            chat_id, line = described
            print(f"{chat_id:<18} {line}")
            if chat_id not in seen:
                seen.add(chat_id)
                if chat_id.startswith("-100"):
                    print(f"{'':<18} ↳ a channel or supergroup — this is the one")
            if args.once:
                print(f"\nTELEGRAM_CHAT_ID={chat_id}")
                return 0

    if seen:
        print("\nSeen:")
        for chat_id in sorted(seen):
            print(f"  TELEGRAM_CHAT_ID={chat_id}")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\nstopped")
        sys.exit(0)
