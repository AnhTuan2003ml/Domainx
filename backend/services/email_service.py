import smtplib
from email.message import EmailMessage

from config import SMTP_APP_PASSWORD, SMTP_EMAIL, SMTP_HOST, SMTP_PORT, SMTP_TIMEOUT_SECONDS


def send_registration_otp(recipient_email, otp_code, expires_minutes):
    sender_email = (SMTP_EMAIL or "").strip()
    app_password = (SMTP_APP_PASSWORD or "").replace(" ", "").strip()
    missing = []
    if not sender_email:
        missing.append("DOMIX_SMTP_EMAIL")
    if not app_password:
        missing.append("DOMIX_SMTP_APP_PASSWORD")
    if missing:
        raise RuntimeError(
            "Chưa cấu hình " + ", ".join(missing)
            + ". Hãy khai báo trong file .env ở thư mục gốc hoặc biến môi trường hệ thống rồi khởi động lại server."
        )

    message = EmailMessage()
    message["Subject"] = "Mã xác thực đăng ký tài khoản DOMIX"
    message["From"] = f"DOMIX <{sender_email}>"
    message["To"] = recipient_email
    message.set_content(
        "Mã OTP đăng ký DOMIX của bạn là: {}\n"
        "Mã có hiệu lực trong {} phút.\n"
        "Không cung cấp mã này cho người khác.".format(otp_code, expires_minutes)
    )
    message.add_alternative(
        """
        <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;border:1px solid #e6e8ec;border-radius:14px;background:#ffffff">
          <div style="font-size:12px;letter-spacing:2px;color:#657083">DOMIX · XÁC THỰC TÀI KHOẢN</div>
          <h2 style="margin:14px 0 8px;color:#18294a">Mã OTP đăng ký</h2>
          <p style="color:#556070;line-height:1.6">Dùng mã dưới đây để hoàn tất đăng ký tài khoản DOMIX:</p>
          <div style="font-size:34px;font-weight:700;letter-spacing:9px;color:#18294a;background:#f2f5f9;padding:18px 20px;border-radius:12px;text-align:center">{}</div>
          <p style="margin-top:18px;color:#7a8492;font-size:13px">Mã có hiệu lực trong {} phút. Không cung cấp mã này cho người khác.</p>
        </div>
        """.format(otp_code, expires_minutes),
        subtype="html",
    )

    with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=SMTP_TIMEOUT_SECONDS) as smtp:
        smtp.login(sender_email, app_password)
        smtp.send_message(message)
