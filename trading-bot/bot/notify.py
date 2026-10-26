import logging

import requests

log = logging.getLogger("bot")


def send(token: str, chat_id: str, text: str) -> None:
    """Manda un mensaje a Telegram. Si no hay credenciales, solo registra en el log."""
    log.info(text)
    if not (token and chat_id):
        return
    try:
        requests.post(
            f"https://api.telegram.org/bot{token}/sendMessage",
            json={"chat_id": chat_id, "text": text},
            timeout=10,
        )
    except requests.RequestException as e:
        log.warning("Telegram fallo: %s", e)


def get_updates(token: str, offset: int | None) -> list:
    params = {"timeout": 0}
    if offset is not None:
        params["offset"] = offset
    r = requests.get(f"https://api.telegram.org/bot{token}/getUpdates", params=params, timeout=10)
    r.raise_for_status()
    return r.json().get("result", [])
