import secrets
from datetime import UTC, datetime, timedelta

import bcrypt
from loguru import logger


def hash_password(password: str) -> str:
    """_summary_
    Hashes a plaintext password using bcrypt with an automatically generated salt.

    Args:
        password (str): Plaintext password to hash.

    Returns:
        str: Bcrypt hashed password string.
    """
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str | None) -> bool:
    """_summary_
    Verifies a plaintext password against a stored bcrypt hash using constant-time check.

    Args:
        plain_password (str): Plaintext password to verify.
        hashed_password (Optional[str]): Stored bcrypt hash string.

    Returns:
        bool: True if password matches hash, False otherwise.
    """
    if not hashed_password:
        return False
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8"),
        )
    except Exception as exc:
        logger.warning(
            "verify_password raised an unexpected exception (possible hash corruption?): {}", exc
        )
        return False


def generate_otp(length: int = 6) -> str:
    """_summary_
    Generates a cryptographically secure random numeric One-Time Password (OTP).

    Args:
        length (int): Number of digits in the OTP (default is 6).

    Returns:
        str: Generated OTP string with leading zeroes padded.
    """
    max_val = 10**length
    otp_number = secrets.randbelow(max_val)
    return f"{otp_number:0{length}d}"


def get_otp_expiry(minutes: int = 10) -> datetime:
    """_summary_
    Calculates a future UTC timestamp for OTP expiration.

    Args:
        minutes (int): Minutes from now until expiration (default is 10).

    Returns:
        datetime: Timezone-aware UTC expiration datetime.
    """
    return datetime.now(UTC) + timedelta(minutes=minutes)


def extract_bearer_token(auth_header: str | None) -> str | None:
    """Extracts a token string from an Authorization header value.

    Supports both 'Bearer <token>' and raw '<token>' header formats.
    """
    if not auth_header:
        return None
    parts = auth_header.strip().split()
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1]
    elif len(parts) == 1:
        return parts[0]
    return None
