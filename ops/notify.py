#!/usr/bin/env python3
"""Send one line to the archive's Telegram channel, and say nothing otherwise.

Used only by the backup scripts, and only when something has gone wrong. The
channel carries bad news and submissions and nothing else, so there is no
"backup succeeded" message here — the review page's backups tab is where a good
night is visible. See README, "Notifications".

Standard library only, so it runs against a bare python3 on the server as
happily as it does here, and it borrows the two pieces it needs from
scripts/telegram_check.py rather than repeating them.

Both this file and scripts/ are shipped to /opt/sticker-song by the deploy
workflow, which is what makes `telegram_check.REPO_ROOT` resolve to the server's
checkout and find the real credentials in its .env. Moving either directory
breaks that quietly, so move both or neither.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

from telegram_check import call, env_or_dotenv  # noqa: E402


def send(text: str) -> int:
    token = env_or_dotenv("TELEGRAM_BOT_TOKEN")
    chat = env_or_dotenv("TELEGRAM_CHAT_ID")
    if not token or not chat:
        # A stack without a channel is a normal stack, not a broken one.
        return 0
    try:
        call(
            token,
            "sendMessage",
            chat_id=chat,
            text=text,
            parse_mode="HTML",
            disable_web_page_preview="true",
        )
    except RuntimeError as exc:
        print(f"could not notify Telegram: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("usage: notify.py <message>", file=sys.stderr)
        raise SystemExit(2)
    raise SystemExit(send(sys.argv[1]))
