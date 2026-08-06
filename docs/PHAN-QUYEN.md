# DOMIX — Ai được xem và làm gì trên hệ thống

Tài liệu dành cho người dùng DOMIX: nhân viên, trưởng nhóm, kế toán và ban giám đốc.
Đọc để biết **tài khoản của mình mở được mục nào, xem được dữ liệu gì, được thêm — sửa — xóa những gì**.

---

## 1. Hệ thống phân quyền hoạt động thế nào

Quyền của bạn được quyết định bởi **hai thứ**:

**Thứ nhất — loại tài khoản:**

| Loại tài khoản | Ai dùng | Phạm vi |
|---|---|---|
| **Quản trị / Sếp** | Giám đốc, người quản trị hệ thống | Toàn quyền. Là người **duy nhất** sửa được hồ sơ nhân sự |
| **Kế toán** | Kế toán, tài chính | Toàn quyền nghiệp vụ, nhưng **không** sửa được hồ sơ nhân sự |
| **Nhân viên** | Tất cả người còn lại | Khu vực cá nhân, cộng thêm quyền theo vị trí công việc |

**Thứ hai — vị trí công việc** ghi trong hồ sơ nhân sự (Marketing, Sale, Kỹ thuật, CSKH…). Vị trí quyết định nhân viên mở thêm được mục nào.

> Nếu hồ sơ nhân sự của bạn thuộc nhóm **Kế toán / Tài chính**, hệ thống tự nâng tài khoản lên quyền Kế toán.

---

## 2. Bạn mở được những mục nào

**Sếp / Quản trị** và **Kế toán**: mở được tất cả các mục — Tổng quan, Thu chi, Công nợ, Vốn góp, Tài sản, Quỹ, Hoạch định, CRM, Marketing, Hợp tác phân phối, Kho hàng, Hợp đồng, Hỗ trợ khách hàng, Giao việc, Tin nhắn, Nhân sự, Tuyển dụng, Chấm công, Hiệu suất, Lương, Trợ lý AI, Pháp lý, Cấu hình.

**Nhân viên**: ai cũng có sẵn 6 mục — **CRM, Giao việc, Tin nhắn, Chấm công, Lương, Tài khoản**. Tùy vị trí công việc sẽ được mở thêm:

| Vị trí công việc | Mở thêm mục |
|---|---|
| Marketing / Ads | Marketing, Kho hàng |
| Sale / Kinh doanh | Marketing, Kho hàng, Hỗ trợ khách hàng |
| Hỗ trợ kỹ thuật | Kho hàng, Hỗ trợ khách hàng |
| IT / Phát triển phần mềm | Kho hàng |
| Nhân sự / HR | Nhân sự, Tuyển dụng, Chấm công, Hiệu suất |
| Vận hành | Kho hàng, Hợp đồng, Hỗ trợ khách hàng |
| Chăm sóc khách hàng | Kho hàng, Hỗ trợ khách hàng |
| Quản lý / Ban giám đốc | Tổng quan, Marketing, Kho hàng, Hợp đồng, Hỗ trợ khách hàng, Nhân sự, Hiệu suất |
| Khác | Không mở thêm mục nào |

---

## 3. Bảng quyền theo từng mục

Ký hiệu: **Toàn quyền** = xem, thêm, sửa, xóa · **Giới hạn** = chỉ làm được phần ghi trong ô · **Không** = không truy cập.

### Tài chính — Thu chi, Công nợ, Vốn góp, Tài sản, Quỹ

| | Sếp / Quản trị | Kế toán | Nhân viên |
|---|---|---|---|
| **Thu chi** | Toàn quyền | Toàn quyền | Chỉ **xem** khoản thu chi liên quan tới chính mình. Không thêm, không sửa, không xóa |
| **Công nợ** | Toàn quyền | Toàn quyền | Không (riêng vị trí Quản lý được xem) |
| **Vốn góp** | Toàn quyền | Toàn quyền | Không |
| **Tài sản cố định** | Toàn quyền | Toàn quyền | Không |
| **Hợp tác phân phối** | Toàn quyền | Toàn quyền | Không |

### CRM — đơn hàng và khách hàng

| | Sếp / Quản trị | Kế toán | Nhân viên |
|---|---|---|---|
| **Đơn hàng** | Toàn quyền | Toàn quyền | Chỉ **xem đơn của chính mình**. Sale được **tạo đơn mới** |
| **Khách hàng tiềm năng (lead)** | Toàn quyền | Toàn quyền | Sale và Marketing được **xem, thêm, sửa lead của mình** |
| **Danh sách khách hàng** | Toàn quyền | Toàn quyền | Không (riêng Quản lý được xem) |

### Kho hàng

| | Sếp / Quản trị | Kế toán | Nhân viên |
|---|---|---|---|
| **Sản phẩm** | Toàn quyền | Toàn quyền | **Hàng chung của công ty (chưa giao cho ai phụ trách): mọi nhân viên đều xem được.** Hàng đã giao đích danh: chỉ người được giao mới thấy. Về sửa: Sale, Marketing, Kỹ thuật, IT, Vận hành sửa được **hàng giao cho mình**; CSKH và Quản lý xem toàn bộ nhưng không sửa |
| **Nhật ký nhập xuất kho** | Toàn quyền | Toàn quyền | Chỉ **ghi thêm** cho sản phẩm được phân công. Không sửa, không xóa bản ghi cũ |

> **Cách hiểu nhanh mục Kho hàng:** một mặt hàng để trống ô *Nhân viên phụ trách* là **hàng chung** — cả công ty cùng xem. Khi Sếp hoặc Kế toán gán một người phụ trách, mặt hàng đó **chỉ hiện với người được gán** (và Sếp, Kế toán, CSKH, Quản lý). Nhân viên chỉ **sửa** được hàng giao cho mình, không tạo mới, không xóa và không đổi người phụ trách.

### Nhân sự, Chấm công, Lương

| | Sếp / Quản trị | Kế toán | Nhân viên |
|---|---|---|---|
| **Hồ sơ nhân sự** | Toàn quyền — **chỉ Sếp** mới thêm, sửa, xóa hồ sơ | Xem hồ sơ; **chỉ sửa được các khoản tính lương** (phụ cấp, KPI, mục tiêu thưởng, thưởng khác, tạm ứng). Không sửa nhân thân, hợp đồng, chấm công; không thêm/xóa hồ sơ | Xem danh sách, nhưng **thông tin nhạy cảm của người khác bị ẩn**. Chỉ sửa được ảnh đại diện của mình |
| **Chấm công** | Duyệt đơn và ghi ngày công | Duyệt đơn và ghi ngày công | **Tạo đơn của chính mình cho ngày hôm nay**. Đơn đã duyệt không sửa được |
| **Đề xuất lương, tạm ứng** | Duyệt cấp cuối | Thẩm định trước khi trình Sếp | **Tạo và sửa đề xuất của chính mình** khi chưa được duyệt |
| **Phụ cấp & KPI thưởng** | Toàn quyền | **Toàn quyền** — khai báo phụ cấp (ăn trưa, xăng xe, OT, sinh con…), chấm KPI, đặt mục tiêu thưởng | Chỉ xem của mình trong phiếu lương |
| **Phiếu chi lương** | Chỉ tạo qua chức năng chi lương | Chỉ tạo qua chức năng chi lương | Không |
| **Tuyển dụng / hồ sơ ứng viên** | Toàn quyền | Toàn quyền | Vị trí Nhân sự được xem |

### Giao việc

| | Sếp / Quản trị | Kế toán | Nhân viên |
|---|---|---|---|
| **Công việc** | Giao việc, sửa, **xóa**, duyệt hoàn tất | Xem toàn bộ, duyệt việc do mình giao — **không xóa được** | **Xem việc của mình** và việc công khai. **Xác nhận nhận việc**, **gửi hoàn tất** việc của mình. Nếu bạn là người giao việc thì được **duyệt hoàn tất** việc đó |
| **Lịch sử công việc** | Xem, xuất Excel | Xem, xuất Excel | Xem lịch sử việc mình thấy được |
| **Dọn dữ liệu theo tháng** | Chỉ Sếp | Không | Không |

> **Việc và ca đã hoàn tất không bao giờ tự xóa.** Chúng được giữ lại vĩnh viễn để đối soát và xuất báo cáo; chỉ hiển thị ở phần lịch sử thay vì danh sách đang xử lý. Duy nhất tài khoản **Sếp / Quản trị** mới chủ động xóa được — Kế toán và nhân viên đều không xóa được, kể cả khi việc đã xong.

### Hỗ trợ khách hàng

| | Sếp / Quản trị | Kế toán | Nhân viên |
|---|---|---|---|
| **Ca hỗ trợ** | Toàn quyền | Xem, sửa, duyệt — **không xóa được** | Xem ca liên quan tới mình (CSKH và Quản lý xem toàn bộ). Người được giao **xác nhận tiếp nhận** và **báo hoàn tất**; người giao ca **duyệt hoàn tất** |
| **Giao ca mới** | Được | Được | Sale, Kỹ thuật, IT, CSKH, Vận hành được giao ca |
| **Xóa ca** | **Chỉ Sếp** | Không | Không |

### Marketing, Hợp đồng, Nội dung khác

| | Sếp / Quản trị | Kế toán | Nhân viên |
|---|---|---|---|
| **Nhật ký Marketing** | Toàn quyền | Toàn quyền | Sale và Marketing **thêm, sửa nhật ký của chính mình** |
| **Trang / chiến dịch Marketing** | Toàn quyền | Toàn quyền | Không |
| **Hợp đồng** | Toàn quyền | Toàn quyền | Vận hành và Quản lý được xem |
| **Thông báo nội bộ** | Toàn quyền | Toàn quyền | Chỉ đọc |
| **Cấu hình công ty** | Toàn quyền | Xem thông tin cơ bản | Xem thông tin cơ bản |
| **Tin nhắn** | Được | Được | Được, trong phạm vi hội thoại của mình |

---

## 4. Thông tin nào bị ẩn khỏi nhân viên

Khi bạn không phải Sếp hoặc Kế toán, hồ sơ **của người khác** sẽ bị ẩn các thông tin sau (hồ sơ của chính bạn vẫn hiện đầy đủ):

- Lương, thưởng, phụ cấp, tạm ứng, loại hợp đồng, số người phụ thuộc
- Bảng chấm công và giờ vào ra
- Chỉ tiêu và kết quả cá nhân: doanh số, số đơn chốt, chi phí quảng cáo, số việc hoàn thành…
- Thông tin cá nhân: ngày sinh, quê quán, số điện thoại, số CCCD, tài khoản ngân hàng
- Ảnh CCCD, CV, trình độ học vấn

Mật khẩu giám đốc không bao giờ hiển thị cho bất kỳ ai, kể cả tài khoản Sếp.

---

## 5. Các quy trình nhiều bước

### Giao việc — việc chỉ hoàn tất khi người giao duyệt

| Bước | Ai làm | Chuyện gì xảy ra |
|---|---|---|
| 1 | **Người giao việc** (Sếp) giao việc | Người nhận được tin nhắn báo có việc mới, kèm chuông thông báo |
| 2 | **Người được giao** bấm *Xác nhận nhận việc* | Người giao được báo lại là đã nhận việc |
| 3 | **Người được giao** bấm *Hoàn tất công việc*, nhập kết quả đã làm | Việc chuyển sang **Chờ duyệt hoàn tất**. Người giao nhận tin nhắn kèm nội dung báo cáo |
| 4 | **Người đã giao việc** bấm *Duyệt hoàn tất* | Lúc này việc mới được tính là **hoàn thành**. Người làm nhận thông báo |
| 4' | Hoặc bấm *Chưa đạt* kèm lý do | Việc quay lại cho người làm xử lý tiếp |

Lưu ý: người giao việc **không tự bấm hoàn tất thay** nhân viên được. Nhân viên cũng **không tự đóng việc** của mình.

### Hỗ trợ khách hàng — cũng theo đúng nguyên tắc trên

| Bước | Ai làm | Chuyện gì xảy ra |
|---|---|---|
| 1 | **Sale (hoặc người phụ trách)** giao ca cho nhân sự kỹ thuật | Người nhận được **email** và **tin nhắn** trong hệ thống |
| 2 | **Đúng người được giao** bấm *Xác nhận tiếp nhận* | Sale được báo lại ngay |
| 3 | **Người được giao** bấm *Hoàn tất*, nhập kết quả xử lý | Ca chuyển sang **Chờ duyệt hoàn tất**, Sale nhận tin nhắn |
| 4 | **Người đã giao ca** bấm *Duyệt hoàn tất* | Ca đóng lại, kết quả được ghi vào nhật ký chăm sóc của đơn hàng |
| 4' | Hoặc bấm *Chưa đạt* kèm lý do | Ca quay lại cho kỹ thuật xử lý tiếp |

Chỉ nhân sự thuộc nhóm **Hỗ trợ kỹ thuật, IT hoặc CSKH** mới nhận được ca, và phải có email tài khoản để nhận thông báo.

### Lương

Nhân viên tạo đề xuất → Kế toán thẩm định → Sếp duyệt → Kế toán chi lương. Kỳ lương đã chi không bị xóa mất hồ sơ duyệt.

### Chấm công

Nhân viên tạo đơn cho ngày hôm nay → Sếp hoặc Kế toán duyệt → ngày công chính thức mới được ghi vào hồ sơ.

---

## 6. Thông báo bạn sẽ nhận được

Hệ thống báo bằng **chuông + thẻ thông báo góc màn hình**, bấm vào là mở thẳng mục liên quan:

| Bạn nhận thông báo khi | Ai nhận |
|---|---|
| Có tin nhắn mới | Mọi người |
| Được giao việc mới | Người nhận việc |
| Được giao ca hỗ trợ mới | Người nhận ca (kèm email) |
| Nhân viên gửi hoàn tất công việc / báo hoàn tất ca hỗ trợ | Người đã giao |
| Việc hoặc ca của bạn được duyệt hoàn tất | Người làm |
| Việc hoặc ca bị trả lại | Người làm |

Số đỏ trên mục **Giao việc** đếm số việc và ca **chưa xác nhận hoặc đang chờ bạn duyệt** — chỉ hết khi bạn bấm xử lý, không tự mất khi mở mục.

Có thể bật/tắt âm thanh trong thanh bên trái, mục **Âm thanh thông báo**. Trình duyệt chỉ cho phát tiếng sau khi bạn bấm vào trang lần đầu.

---

## 7. Câu hỏi thường gặp

**Tôi không thấy nút "Hoàn tất" ở việc / ca được giao?**
Nút này chỉ hiện với **đúng tài khoản được giao**, và chỉ sau khi đã bấm *Xác nhận nhận việc* / *Xác nhận tiếp nhận*. Nếu vẫn không thấy, nhờ Sếp kiểm tra hồ sơ nhân sự của bạn đã liên kết đúng tài khoản đăng nhập chưa.

**Tôi không thấy nút "Duyệt hoàn tất"?**
Nút chỉ hiện với **người đã giao** việc/ca đó, hoặc tài khoản Sếp và Kế toán. Nếu việc do người khác giao, bạn không duyệt được.

**Tôi sửa dữ liệu nhưng lưu xong lại như cũ?**
Đó là do tài khoản của bạn không có quyền sửa phần dữ liệu đó — hệ thống giữ nguyên bản gốc thay vì báo lỗi. Tra bảng ở mục 3 để biết mình được sửa gì.

**Tôi muốn mở thêm mục khác?**
Nhờ Sếp đổi **Nhóm vị trí** trong hồ sơ nhân sự của bạn (mục Nhân sự). Quyền sẽ áp dụng ngay sau khi bạn tải lại trang.

**Vì sao tôi không xem được lương và thông tin cá nhân của đồng nghiệp?**
Đây là thiết kế cố ý để bảo mật thông tin nhân sự. Chỉ Sếp và Kế toán xem được đầy đủ.

**Tôi vừa được cấp tài khoản nhưng không thấy gì ngoài mấy mục cơ bản?**
Tài khoản chưa được gắn với hồ sơ nhân sự. Nhờ Sếp mở mục Nhân sự, mở hồ sơ của bạn và gắn tài khoản đăng nhập vào.
