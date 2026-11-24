import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

# Local development reads backend/.env. To run a command against production (for example
# createsuperuser on Supabase), set DJANGO_ENV_FILE=.env.prod. Both files follow .env.example
# line for line. Variables already set in the environment (Render) always win.
ENV_FILE = BASE_DIR / os.getenv("DJANGO_ENV_FILE", ".env")
load_dotenv(ENV_FILE)

SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "local-only-insecure-key-change-before-deploy")
DEBUG = os.getenv("DJANGO_DEBUG", "true").lower() in {"1", "true", "yes"}
if not DEBUG and SECRET_KEY == "local-only-insecure-key-change-before-deploy":
    raise RuntimeError("Set a unique DJANGO_SECRET_KEY before running in production")
ALLOWED_HOSTS = [host.strip() for host in os.getenv("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",") if host.strip()]
if os.getenv("RENDER_EXTERNAL_HOSTNAME"):
    ALLOWED_HOSTS.append(os.environ["RENDER_EXTERNAL_HOSTNAME"])
CSRF_TRUSTED_ORIGINS = [origin.strip() for origin in os.getenv("CSRF_TRUSTED_ORIGINS", "").split(",") if origin.strip()]
CORS_ALLOWED_ORIGINS = [origin.strip() for origin in os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",") if origin.strip()]

INSTALLED_APPS = [
    "admin_ui",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "bookings",
    "menu",
    "accounts",
    "staff",  # last: fills preset roles once every app's permissions exist
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "config.middleware.CorsMiddleware",
]

ROOT_URLCONF = "config.urls"
TEMPLATES = [{
    "BACKEND": "django.template.backends.django.DjangoTemplates",
    "DIRS": [],
    "APP_DIRS": True,
    "OPTIONS": {"context_processors": [
        "django.template.context_processors.request",
        "django.contrib.auth.context_processors.auth",
        "django.contrib.messages.context_processors.messages",
    ]},
}]
WSGI_APPLICATION = "config.wsgi.application"

DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
if DATABASE_URL:
    from urllib.parse import unquote, urlparse

    parsed = urlparse(DATABASE_URL)
    if parsed.scheme not in {"postgres", "postgresql"}:
        raise RuntimeError("DATABASE_URL must use postgres:// or postgresql://")
    DATABASES = {"default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": unquote(parsed.path.lstrip("/")),
        "USER": unquote(parsed.username or ""),
        "PASSWORD": unquote(parsed.password or ""),
        "HOST": parsed.hostname,
        "PORT": parsed.port or 5432,
        "OPTIONS": {"sslmode": os.getenv("DB_SSLMODE", "require")},
        "CONN_MAX_AGE": int(os.getenv("DB_CONN_MAX_AGE", "60")),
    }}
else:
    DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": BASE_DIR / "db.sqlite3"}}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]
# English (Australia) only. The venue is in Lightsview, SA: all dates and times are Adelaide time
# (ACST/ACDT, daylight saving handled automatically).
LANGUAGE_CODE = "en-au"
LANGUAGES = [("en-au", "English")]
TIME_ZONE = "Australia/Adelaide"
USE_I18N = True
USE_TZ = True
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend" if DEBUG else "bookings.email.BrevoEmailBackend"
DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", "Lumi Lane <no-reply@example.com>")
BOOKING_NOTIFICATION_EMAIL = os.getenv("BOOKING_NOTIFICATION_EMAIL", "")
BREVO_API_KEY = os.getenv("BREVO_API_KEY", "")
BREVO_API_URL = "https://api.brevo.com/v3/smtp/email"
PUBLIC_BACKEND_URL = os.getenv("PUBLIC_BACKEND_URL", "")
PUBLIC_BACKEND_URL = PUBLIC_BACKEND_URL.rstrip("/")
PUBLIC_WEBSITE_URL = os.getenv("PUBLIC_WEBSITE_URL", "http://localhost:3000").rstrip("/")
if not DEBUG:
    missing = [
        name for name, value in {
            "BREVO_API_KEY": BREVO_API_KEY,
            "BOOKING_NOTIFICATION_EMAIL": BOOKING_NOTIFICATION_EMAIL,
            "DEFAULT_FROM_EMAIL": DEFAULT_FROM_EMAIL,
            "PUBLIC_BACKEND_URL": PUBLIC_BACKEND_URL,
            "CORS_ALLOWED_ORIGINS": ",".join(CORS_ALLOWED_ORIGINS),
        }.items() if not value.strip()
    ]
    if missing:
        raise RuntimeError(f"Missing required production settings: {', '.join(missing)}")

SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"
