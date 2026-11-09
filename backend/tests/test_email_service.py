"""Unit tests for the email service using Resend."""

from unittest.mock import MagicMock, patch

import pytest

from app.services.email_service import (
    build_otp_email_html,
    build_otp_email_text,
    get_sender_address,
    send_otp_email,
)


def test_build_otp_email_html() -> None:
    """Test HTML template rendering with and without recipient name."""
    html_with_name = build_otp_email_html("123456", "Alice")
    assert "123456" in html_with_name
    assert "Hello Alice," in html_with_name
    assert "code0" in html_with_name

    html_no_name = build_otp_email_html("654321", None)
    assert "654321" in html_no_name
    assert "Hello," in html_no_name


def test_build_otp_email_text() -> None:
    """Test plain text template rendering."""
    text_content = build_otp_email_text("789012", "Bob")
    assert "789012" in text_content
    assert "Hello Bob," in text_content
    assert "10 minutes" in text_content


def test_get_sender_address(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test sender address resolution with and without brackets."""
    from app.config import settings

    monkeypatch.setattr(settings, "FROM_EMAIL", "test@bbitclub.io")
    assert get_sender_address() == "code0 <test@bbitclub.io>"

    monkeypatch.setattr(settings, "FROM_EMAIL", "Custom Sender <custom@bbitclub.io>")
    assert get_sender_address() == "Custom Sender <custom@bbitclub.io>"


@pytest.mark.asyncio
async def test_send_otp_email_without_api_key(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test that email delivery is safely skipped when API key is missing."""
    from app.config import settings

    monkeypatch.setattr(settings, "RESEND_API_KEY", "")
    # Unmock send_otp_email for this specific test
    result = await send_otp_email("user@example.com", "123456", "Test User")
    assert result is None


@pytest.mark.asyncio
async def test_send_otp_email_success(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test successful email dispatch via Resend SDK."""
    from app.config import settings

    monkeypatch.setattr(settings, "RESEND_API_KEY", "re_test_key_12345")
    monkeypatch.setattr(settings, "FROM_EMAIL", "codersclub@bbitclub.io")

    mock_send = MagicMock(return_value={"id": "email_test_123"})
    with patch("resend.Emails.send", mock_send):
        result = await send_otp_email("alice@example.com", "999888", "Alice")
        assert result == {"id": "email_test_123"}
        mock_send.assert_called_once()
        call_args = mock_send.call_args[0][0]
        assert call_args["to"] == ["alice@example.com"]
        assert "999888" in call_args["subject"]
        assert call_args["from"] == "code0 <codersclub@bbitclub.io>"


@pytest.mark.asyncio
async def test_send_otp_email_failure_raises(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test that errors during email delivery raise an exception."""
    from app.config import settings

    monkeypatch.setattr(settings, "RESEND_API_KEY", "re_test_key_12345")

    with patch("resend.Emails.send", side_effect=RuntimeError("Resend API rate limit")):
        with pytest.raises(RuntimeError, match="Resend API rate limit"):
            await send_otp_email("bob@example.com", "111222", "Bob")
