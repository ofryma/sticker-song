#!/usr/bin/env python3
"""Check the Telegram ops channel, by hand.

Answers the three questions that come up when notifications go quiet: is the
token real, which chat id is the channel, and does a message actually land.

    scripts/telegram_check.py                 # whoami, find the chat, send samples
    scripts/telegram_check.py --check         # ask, send nothing
    scripts/telegram_check.py --sample deploy # just one shape

Credentials come from ``--token``/``--chat``, then the environment, then a
``.env`` beside this repository — whichever turns up first. Nothing is written
anywhere, and the only thing this can do to the outside world is post a message
to a channel it was pointed at.

Standard library only, so it runs against a bare python3 on the server as
happily as it does here.

The sample messages are shaped like the real ones but they are not the real
ones: the archive's upload notification lives in ``backend/app/notify.py``, and
the deploy and downtime messages live in the two workflows under
``.github/workflows/``. This is a channel test, not a copy test.
"""

import argparse
import html
import json
import os
import ssl
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

API_ROOT = "https://api.telegram.org"
TIMEOUT = 15
REPO_ROOT = Path(__file__).resolve().parent.parent


def env_or_dotenv(name: str) -> str:
    """The variable, from the environment or from the repository's .env."""
    if os.environ.get(name):
        return os.environ[name]
    dotenv = REPO_ROOT / ".env"
    if not dotenv.is_file():
        return ""
    for line in dotenv.read_text(encoding="utf-8", errors="replace").splitlines():
        key, _, value = line.partition("=")
        if key.strip() == name:
            return value.strip().strip("\"'")
    return ""


def call(token: str, method: str, **params) -> dict:
    """One Telegram API call. Raises RuntimeError with whatever it said back."""
    url = f"{API_ROOT}/bot{token}/{method}"
    data = urllib.parse.urlencode(params).encode() if params else None
    request = urllib.request.Request(url, data=data)
    try:
        with urllib.request.urlopen(
            request, timeout=TIMEOUT, context=ssl.create_default_context()
        ) as response:
            return json.load(response)
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", "replace")
        try:
            described = json.loads(body).get("description", body)
        except json.JSONDecodeError:
            described = body
        raise RuntimeError(f"{method}: HTTP {exc.code}: {described}") from None
    except urllib.error.URLError as exc:
        raise RuntimeError(f"{method}: could not reach Telegram: {exc.reason}") from None


def find_chats(token: str) -> list[tuple[str, str]]:
    """Chats the bot has seen, newest first, as (id, description) pairs.

    A channel only turns up here once the bot is an administrator of it *and*
    something has been posted since, which is the step people miss.
    """
    updates = call(token, "getUpdates", limit=100).get("result", [])
    seen: dict[str, str] = {}
    for update in updates:
        for key in ("channel_post", "message", "edited_channel_post", "my_chat_member"):
            chat = (update.get(key) or {}).get("chat")
            if not chat:
                continue
            title = (
                chat.get("title") or chat.get("username") or chat.get("first_name", "")
            )
            seen[str(chat["id"])] = f"{chat.get('type', '?')} — {title}"
    return list(reversed(seen.items()))


def sample(kind: str) -> str:
    """One message in the shape the archive really sends."""
    name = html.escape("שם מלא / Full Name")
    if kind == "upload":
        return (
            "<b>📥 New submission — waiting for review</b>\n\n"
            f"<b>{name}</b>\n"
            "The transcribed sticker text goes here.\n\n"
            '<a href="https://stkrmem.com/admin">Review '
            "11111111-2222-3333-4444-555555555555</a>"
            "\n\n<i>(sample, sent by scripts/telegram_check.py)</i>"
        )
    if kind == "deploy":
        return (
            "<b>🚢 Deploy finished</b>\n\n"
            "Version <code>1.2.3</code> is live on "
            '<a href="https://stkrmem.com">production</a>.\n'
            "Image <code>sha-0123456789abcdef</code>."
            "\n\n<i>(sample, sent by scripts/telegram_check.py)</i>"
        )
    return (
        "<b>🔴 The archive is not answering</b>\n\n"
        "<code>https://stkrmem.com/api/health</code> failed three checks in a row.\n\n"
        "<code>curl: (28) Operation timed out after 15001 milliseconds</code>"
        "\n\n<i>(sample, sent by scripts/telegram_check.py)</i>"
    )


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Check the Telegram bot, the channel id, and that a message lands."
    )
    parser.add_argument("--token", default="", help="bot token; else TELEGRAM_BOT_TOKEN")
    parser.add_argument("--chat", default="", help="chat id; else TELEGRAM_CHAT_ID")
    parser.add_argument(
        "--sample",
        choices=["upload", "deploy", "downtime", "all"],
        default="all",
        help="which sample message to send (default: all three)",
    )
    parser.add_argument(
        "--check", action="store_true", help="report only; post nothing to the channel"
    )
    parser.add_argument(
        "--find",
        action="store_true",
        help="list the chats the bot can see and stop, even if a chat id is set "
        "(which is what you want when the configured one is wrong)",
    )
    args = parser.parse_args()

    token = args.token or env_or_dotenv("TELEGRAM_BOT_TOKEN")
    chat = args.chat or env_or_dotenv("TELEGRAM_CHAT_ID")

    if not token:
        print(
            "No token. Pass --token, set TELEGRAM_BOT_TOKEN, or put it in .env.\n"
            "A new one comes from @BotFather: /newbot.",
            file=sys.stderr,
        )
        return 2

    # 1. Is the token real, and which bot is it?
    try:
        me = call(token, "getMe")["result"]
    except RuntimeError as exc:
        print(f"The token was refused.\n  {exc}", file=sys.stderr)
        return 1
    print(f"bot     @{me.get('username', '?')} ({me.get('first_name', '')})")

    # 2. Which chat, and does the bot know about it?
    if not chat or args.find:
        if chat:
            print(f"chat    {chat} configured, but asking anyway (--find)")
        else:
            print("chat    not configured — asking Telegram what this bot has seen")
        try:
            chats = find_chats(token)
        except RuntimeError as exc:
            print(f"  {exc}", file=sys.stderr)
            return 1
        if not chats:
            print(
                "\nNothing. The bot has to be an administrator of the channel, and\n"
                "something has to have been posted there since it was added. Post a\n"
                "message in the channel and run this again.",
                file=sys.stderr,
            )
            return 1
        print("\nChats it has seen — the channel is the one starting -100:\n")
        for chat_id, described in chats:
            print(f"  {chat_id:<18} {described}")
        print("\nRe-run with --chat <id>, or set TELEGRAM_CHAT_ID.")
        return 0
    print(f"chat    {chat}")

    if args.check:
        # getChat is the read-only way to prove the bot can see the channel.
        try:
            info = call(token, "getChat", chat_id=chat)["result"]
        except RuntimeError as exc:
            print(f"\nThe bot cannot see that chat.\n  {exc}", file=sys.stderr)
            return 1
        print(f"        {info.get('type', '?')} — {info.get('title', '')}")
        print("\nLooks right. Nothing was posted (--check).")
        return 0

    # 3. Does a message actually land?
    kinds = ["upload", "deploy", "downtime"] if args.sample == "all" else [args.sample]
    for kind in kinds:
        try:
            call(
                token,
                "sendMessage",
                chat_id=chat,
                text=sample(kind),
                parse_mode="HTML",
                disable_web_page_preview="true",
            )
        except RuntimeError as exc:
            print(f"\nThe {kind} sample did not land.\n  {exc}", file=sys.stderr)
            print(
                "\n'chat not found' usually means the id is wrong or the bot was\n"
                "never added; 'not enough rights' means it is not an administrator\n"
                "with Post Messages.",
                file=sys.stderr,
            )
            return 1
        print(f"sent    {kind}")

    print("\nAll of it landed. Check the channel.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
