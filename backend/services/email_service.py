import html
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



def send_inventory_expiry_alert(
    recipient_email,
    recipient_name,
    product_name,
    sku,
    stock,
    unit,
    expiry_date,
    days_left,
    broadcast=False,
):
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
            + ". Hãy khai báo trong file .env ở thư mục gốc rồi khởi động lại server."
        )

    days_left = int(days_left)
    day_label = "hết hạn hôm nay" if days_left == 0 else f"còn {days_left} ngày trước khi hết hạn"
    subject = f"[DOMIX] Kho hàng: {product_name} {day_label}"
    assignment_note = (
        "Sản phẩm chưa có nhân viên phụ trách nên cảnh báo này được gửi tới toàn bộ nhân viên."
        if broadcast
        else "Bạn đang là nhân viên phụ trách xử lý sản phẩm này."
    )

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = f"DOMIX <{sender_email}>"
    message["To"] = recipient_email
    message.set_content(
        f"Xin chào {recipient_name or recipient_email},\n\n"
        f"Sản phẩm trong Kho hàng đang {day_label}.\n"
        f"Sản phẩm: {product_name}\n"
        f"SKU: {sku or '—'}\n"
        f"Tồn kho: {stock} {unit or ''}\n"
        f"Ngày hết hạn: {expiry_date}\n\n"
        f"{assignment_note}\n"
        "Vui lòng mở DOMIX, kiểm tra và xử lý trước khi sản phẩm hết hạn."
    )

    safe_name = html.escape(str(recipient_name or recipient_email or ""))
    safe_product = html.escape(str(product_name or ""))
    safe_sku = html.escape(str(sku or "—"))
    safe_stock = html.escape(f"{stock} {unit or ''}".strip())
    safe_expiry = html.escape(str(expiry_date or ""))
    safe_day = html.escape(day_label.upper())
    safe_assignment = html.escape(assignment_note)
    message.add_alternative(
        f"""
        <div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;padding:24px;border:1px solid #e6e8ec;border-radius:14px;background:#ffffff">
          <div style="font-size:12px;letter-spacing:2px;color:#657083">DOMIX · CẢNH BÁO KHO HÀNG</div>
          <h2 style="margin:14px 0 8px;color:#18294a">{safe_product}</h2>
          <p style="color:#556070;line-height:1.6">Xin chào <strong>{safe_name}</strong>. DOMIX phát hiện sản phẩm trong kho sắp hết hạn.</p>
          <div style="margin:18px 0;padding:14px 16px;border-radius:12px;background:#fff7e8;color:#8a5a00;font-weight:700">{safe_day} · {safe_expiry}</div>
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <tr><td style="padding:8px 10px;color:#697386;border-bottom:1px solid #eef1f5">SKU</td><td style="padding:8px 10px;color:#18294a;font-weight:600;border-bottom:1px solid #eef1f5">{safe_sku}</td></tr>
            <tr><td style="padding:8px 10px;color:#697386;border-bottom:1px solid #eef1f5">Tồn kho</td><td style="padding:8px 10px;color:#18294a;font-weight:600;border-bottom:1px solid #eef1f5">{safe_stock}</td></tr>
            <tr><td style="padding:8px 10px;color:#697386;border-bottom:1px solid #eef1f5">Ngày hết hạn</td><td style="padding:8px 10px;color:#18294a;font-weight:600;border-bottom:1px solid #eef1f5">{safe_expiry}</td></tr>
          </table>
          <p style="margin-top:18px;padding:12px 14px;border-radius:10px;background:#f2f5f9;color:#556070;font-size:13px;line-height:1.6">{safe_assignment}</p>
          <p style="margin-top:18px;color:#7a8492;font-size:13px;line-height:1.6">Vui lòng mở DOMIX, kiểm tra và xử lý trước khi sản phẩm hết hạn.</p>
        </div>
        """,
        subtype="html",
    )

    with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=SMTP_TIMEOUT_SECONDS) as smtp:
        smtp.login(sender_email, app_password)
        smtp.send_message(message)


def send_password_reset_otp(recipient_email, otp_code, expires_minutes):
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
    message["Subject"] = "Mã OTP đặt lại mật khẩu DOMIX"
    message["From"] = f"DOMIX <{sender_email}>"
    message["To"] = recipient_email
    message.set_content(
        "Mã OTP đặt lại mật khẩu DOMIX của bạn là: {}\n"
        "Mã có hiệu lực trong {} phút.\n"
        "Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này và không cung cấp mã cho người khác.".format(
            otp_code,
            expires_minutes,
        )
    )
    message.add_alternative(
        """
        <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;border:1px solid #e6e8ec;border-radius:14px;background:#ffffff">
          <div style="font-size:12px;letter-spacing:2px;color:#657083">DOMIX · BẢO MẬT TÀI KHOẢN</div>
          <h2 style="margin:14px 0 8px;color:#18294a">Đặt lại mật khẩu</h2>
          <p style="color:#556070;line-height:1.6">Dùng mã dưới đây để xác nhận yêu cầu đặt lại mật khẩu DOMIX:</p>
          <div style="font-size:34px;font-weight:700;letter-spacing:9px;color:#18294a;background:#f2f5f9;padding:18px 20px;border-radius:12px;text-align:center">{}</div>
          <p style="margin-top:18px;color:#7a8492;font-size:13px;line-height:1.6">Mã có hiệu lực trong {} phút. Nếu bạn không yêu cầu thao tác này, hãy bỏ qua email và không cung cấp mã cho người khác.</p>
        </div>
        """.format(otp_code, expires_minutes),
        subtype="html",
    )

    with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=SMTP_TIMEOUT_SECONDS) as smtp:
        smtp.login(sender_email, app_password)
        smtp.send_message(message)
