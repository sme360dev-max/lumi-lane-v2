# Lumi Lane Version 2

Bản giao diện thứ hai của Lumi Lane, đóng gói thành hai ứng dụng để deploy độc lập theo cùng kiến trúc với dự án gốc:

```text
lumi-lane-version2/
├── website/  Next.js static export → Cloudflare Pages
├── backend/  Django API + admin → Render
└── scripts/  lệnh phát triển và vận hành
```

Website dùng thiết kế version 2. Backend được chuẩn hóa từ dự án `lumi-lane`, đồng thời có API account, cart, pickup orders và rewards. Django lưu dữ liệu trong Supabase khi deploy; website không kết nối trực tiếp đến database.

## Chạy local

Yêu cầu: Node.js 22.18+ và Python 3.12. Dùng Git Bash/Make hoặc chạy từng ứng dụng riêng.

```powershell
# Backend
cd backend
py -3.12 -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
python manage.py migrate
python manage.py runserver

# Terminal khác: website
cd website
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Mở `http://localhost:3000`. API local mặc định `http://127.0.0.1:8000`. Lệnh tổng quát với GNU Make: `make help`, `make install`, `make migrate`, `make run`, `make website`.

## Deploy

### Backend — Render

Tạo Web Service từ repository này với blueprint `backend/render.yaml` (Render root directory là repository root; blueprint đặt `rootDir: backend`). Tạo một Supabase PostgreSQL riêng cho môi trường version 2 và khai báo `DATABASE_URL`, `DJANGO_ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS`, `BREVO_API_KEY`, `DEFAULT_FROM_EMAIL`, `BOOKING_NOTIFICATION_EMAIL`, `PUBLIC_BACKEND_URL`. Blueprint tạo `DJANGO_SECRET_KEY` và chạy migrations lúc build.

### Website — Cloudflare Pages

Đặt project root directory là `website`, build command `npm run build`, output directory `out`, preset Next.js (Static HTML Export). Đặt biến build `NEXT_PUBLIC_API_BASE_URL=https://<backend-version2>.onrender.com`, sau đó thêm origin Cloudflare Pages vào `CORS_ALLOWED_ORIGINS` và `CSRF_TRUSTED_ORIGINS` trên Render.

## Dữ liệu và chức năng

- Menu có snapshot tĩnh từ `src/data/menu.ts` để luôn hiển thị được. Khi website mở, nó lấy menu đang quản trị từ `GET /api/menu/`; nếu API ngủ hoặc không truy cập được, snapshot vẫn dùng làm dự phòng.
- Account API: `POST /api/account/register/`, `POST /api/account/login/`, `POST /api/account/logout/`, `GET/PATCH /api/account/me/`, `GET/PATCH /api/account/preferences/`, `GET/PUT /api/account/favorites/`, `GET/PUT/DELETE /api/account/cart/`, `GET/POST /api/account/orders/`, `GET /api/account/reservations/`, `GET /api/account/rewards/` và password reset.
- Đơn hàng là yêu cầu pickup, chưa thu tiền online. Nhân viên cập nhật trạng thái trong Django Admin; điểm được cộng khi order chuyển sang **Completed**.
- Django Admin → Loyalty → Program rules cấu hình điểm mỗi order hoàn tất, điểm cần để nhận reward và giá trị reward AUD. Mặc định: 1 điểm/order hoàn tất, đủ 8 điểm nhận $20 AUD credit. Credit dùng cho đơn pickup tiếp theo; đơn hủy được hoàn credit đã áp dụng.
- Booking gửi thật lên backend; booking tạo khi đã login được liên kết với account để hiện trong `/account`.
- Forgot password cần `PUBLIC_WEBSITE_URL` trên Render trỏ tới domain Cloudflare Pages để email reset mở đúng website.
- Không commit `.env`, `.env.local`, database, virtualenv, `node_modules`, `.next` hoặc `out`.

