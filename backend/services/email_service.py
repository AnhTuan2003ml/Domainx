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


def send_support_assignment_email(
    recipient_email,
    recipient_name,
    sender_name,
    order_id,
    order_date,
    customer_name,
    customer_phone,
    customer_email,
    product_name,
    duration_label,
    support_type_label,
    support_channel_label,
    issue,
    details,
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

    recipient_email = str(recipient_email or "").strip()
    if not recipient_email:
        raise ValueError("Nhân sự tiếp nhận chưa có email.")

    # Ca hỗ trợ có thể tạo trực tiếp trong module Hỗ trợ khách hàng (không gắn đơn CRM) — khi đó
    # không được hiển thị "#None" trong tiêu đề và nội dung email.
    order_label = str(order_id or "").strip()
    order_display = f"#{order_label}" if order_label else "Ca tạo trực tiếp (không gắn đơn CRM)"
    subject = (
        f"[DOMIX] Yêu cầu hỗ trợ đơn #{order_label} - {customer_name or 'Khách hàng'}"
        if order_label
        else f"[DOMIX] Yêu cầu hỗ trợ khách hàng - {customer_name or 'Khách hàng'}"
    )
    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = f"DOMIX <{sender_email}>"
    message["To"] = recipient_email
    message.set_content(
        f"Xin chào {recipient_name or recipient_email},\n\n"
        f"Bạn vừa được giao một yêu cầu hỗ trợ trên DOMIX.\n"
        f"Người giao: {sender_name or 'DOMIX'}\n"
        f"Loại yêu cầu: {support_type_label}\n"
        f"Cách thức hỗ trợ: {support_channel_label}\n"
        f"Đơn hàng: {order_display} - ngày {order_date or '—'}\n"
        f"Khách hàng: {customer_name or '—'}\n"
        f"Liên hệ: {customer_phone or '—'} / {customer_email or '—'}\n"
        f"Sản phẩm: {product_name or '—'}\n"
        f"Thời hạn: {duration_label or '—'}\n"
        f"Vấn đề cần hỗ trợ: {issue}\n"
        f"Nội dung cần hỗ trợ: {details}\n\n"
        "Vui lòng mở DOMIX, vào mục Hỗ trợ khách hàng > Nhiệm vụ của tôi để xác nhận tiếp nhận "
        "nhiệm vụ này. Sau khi bạn xác nhận, hệ thống sẽ báo lại cho người giao yêu cầu."
    )

    safe = lambda value: html.escape(str(value or "—"))
    message.add_alternative(
        f"""
        <div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;padding:24px;border:1px solid #e1e6ef;border-radius:16px;background:#ffffff">
          <div style="font-size:12px;letter-spacing:2px;color:#617089">DOMIX · YÊU CẦU HỖ TRỢ KHÁCH HÀNG</div>
          <h2 style="margin:14px 0 6px;color:#17294a">{safe(order_display)} · {safe(customer_name)}</h2>
          <p style="margin:0;color:#6a7688;font-size:13px">Người giao: <strong style="color:#283a58">{safe(sender_name)}</strong></p>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin:18px 0">
            <span style="padding:7px 11px;border-radius:999px;background:#eaf1ff;color:#2857a6;font-size:12px;font-weight:700">{safe(support_type_label)}</span>
            <span style="padding:7px 11px;border-radius:999px;background:#ecf9f2;color:#18734c;font-size:12px;font-weight:700">{safe(support_channel_label)}</span>
          </div>
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <tr><td style="padding:9px 10px;color:#6b7789;border-bottom:1px solid #edf0f5;width:32%">Ngày đơn</td><td style="padding:9px 10px;color:#17294a;font-weight:600;border-bottom:1px solid #edf0f5">{safe(order_date)}</td></tr>
            <tr><td style="padding:9px 10px;color:#6b7789;border-bottom:1px solid #edf0f5">Khách hàng</td><td style="padding:9px 10px;color:#17294a;font-weight:600;border-bottom:1px solid #edf0f5">{safe(customer_name)}</td></tr>
            <tr><td style="padding:9px 10px;color:#6b7789;border-bottom:1px solid #edf0f5">Điện thoại</td><td style="padding:9px 10px;color:#17294a;border-bottom:1px solid #edf0f5">{safe(customer_phone)}</td></tr>
            <tr><td style="padding:9px 10px;color:#6b7789;border-bottom:1px solid #edf0f5">Email khách</td><td style="padding:9px 10px;color:#17294a;border-bottom:1px solid #edf0f5">{safe(customer_email)}</td></tr>
            <tr><td style="padding:9px 10px;color:#6b7789;border-bottom:1px solid #edf0f5">Sản phẩm</td><td style="padding:9px 10px;color:#17294a;border-bottom:1px solid #edf0f5">{safe(product_name)}</td></tr>
            <tr><td style="padding:9px 10px;color:#6b7789;border-bottom:1px solid #edf0f5">Thời hạn</td><td style="padding:9px 10px;color:#17294a;border-bottom:1px solid #edf0f5">{safe(duration_label)}</td></tr>
          </table>
          <div style="margin-top:18px;padding:15px 16px;border-radius:12px;background:#fff7e7;border:1px solid #f2d8a2">
            <div style="font-size:12px;font-weight:700;color:#8a5d00;text-transform:uppercase;letter-spacing:.6px">Vấn đề cần hỗ trợ</div>
            <div style="margin-top:7px;color:#4f3c14;line-height:1.6">{safe(issue)}</div>
          </div>
          <div style="margin-top:12px;padding:15px 16px;border-radius:12px;background:#f3f6fa;border:1px solid #e0e6ef">
            <div style="font-size:12px;font-weight:700;color:#4f6078;text-transform:uppercase;letter-spacing:.6px">Nội dung cần hỗ trợ</div>
            <div style="margin-top:7px;color:#35445a;line-height:1.65;white-space:pre-wrap">{safe(details)}</div>
          </div>
          <p style="margin:20px 0 0;color:#778397;font-size:13px;line-height:1.6">Mở DOMIX &gt; <strong style="color:#17294a">Hỗ trợ khách hàng</strong> &gt; <strong style="color:#17294a">Nhiệm vụ của tôi</strong> để xác nhận tiếp nhận nhiệm vụ. Sau khi xác nhận, hệ thống báo lại ngay cho người giao yêu cầu.</p>
        </div>
        """,
        subtype="html",
    )

    with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=SMTP_TIMEOUT_SECONDS) as smtp:
        smtp.login(sender_email, app_password)
        smtp.send_message(message)
