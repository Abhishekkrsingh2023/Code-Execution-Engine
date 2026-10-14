from fastapi import Response
from loguru import logger

from app.config import settings


def set_auth_cookies(
    response: Response,
    access_token: str,
    refresh_token: str | None = None,
) -> None:
    """Sets HTTP-only authentication cookies on the response for access and refresh tokens.

    Args:
        response: FastAPI / Starlette response object.
        access_token: Encoded JWT access token.
        refresh_token: Optional encoded JWT refresh token.
    """
    access_max_age = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    response.set_cookie(
        key=settings.ACCESS_TOKEN_COOKIE_NAME,
        value=access_token,
        max_age=access_max_age,
        expires=access_max_age,
        path=settings.COOKIE_PATH,
        domain=settings.COOKIE_DOMAIN,
        secure=settings.COOKIE_SECURE,
        httponly=settings.COOKIE_HTTPONLY,
        samesite=settings.COOKIE_SAMESITE,  # "lax", "strict", or "none"
    )

    if refresh_token:
        refresh_max_age = settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400
        response.set_cookie(
            key=settings.REFRESH_TOKEN_COOKIE_NAME,
            value=refresh_token,
            max_age=refresh_max_age,
            expires=refresh_max_age,
            path=settings.COOKIE_PATH,
            domain=settings.COOKIE_DOMAIN,
            secure=settings.COOKIE_SECURE,
            httponly=settings.COOKIE_HTTPONLY,
            samesite=settings.COOKIE_SAMESITE,
        )

    logger.debug(
        "Attached authentication cookies | access_token (max_age={}s) | refresh_token present={}",
        access_max_age,
        bool(refresh_token),
    )


def clear_auth_cookies(response: Response) -> None:
    """Clears authentication cookies from the response by deleting them.

    Args:
        response: FastAPI / Starlette response object.
    """
    response.delete_cookie(
        key=settings.ACCESS_TOKEN_COOKIE_NAME,
        path=settings.COOKIE_PATH,
        domain=settings.COOKIE_DOMAIN,
        secure=settings.COOKIE_SECURE,
        httponly=settings.COOKIE_HTTPONLY,
        samesite=settings.COOKIE_SAMESITE,
    )
    response.delete_cookie(
        key=settings.REFRESH_TOKEN_COOKIE_NAME,
        path=settings.COOKIE_PATH,
        domain=settings.COOKIE_DOMAIN,
        secure=settings.COOKIE_SECURE,
        httponly=settings.COOKIE_HTTPONLY,
        samesite=settings.COOKIE_SAMESITE,
    )
    logger.debug("Cleared authentication cookies from client response")
