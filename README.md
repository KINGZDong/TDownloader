# TDownloader

**TDownloader** is a powerful, self-hosted Telegram file manager and downloader built with React, Node.js, and TDLib. It allows you to browse your chats, filter media types, and download files directly to your local server with high speed and stability.

## Features

*   🚀 **High Performance**: Built on top of native TDLib (Telegram Database Library).
*   📂 **File Management**: Browse chats, filter by type (Image, Video, Audio, Document), and search by date.
*   💾 **Batch Downloading**: Select multiple files and download them to your local downloads folder.
*   🔄 **Multi-Account**: Switch between multiple Telegram accounts easily.
*   🛡️ **Proxy Support**: Built-in SOCKS5/HTTP/MTProto proxy configuration.

---

## 🛠️ Prerequisites

Before you begin, you need to obtain your Telegram API Credentials:

1.  Log in to [my.telegram.org](https://my.telegram.org).
2.  Go to **API development tools**.
3.  Create a new application to get your `API_ID` and `API_HASH`.

### System Requirements

*   **Node.js**: v18 or higher.
*   **TDLib Binary**: You need the compiled `libtdjson` dynamic library for your operating system.

---

## 📥 Installation

### 1. Clone the Repository
```bash
git clone https://github.com/your/tdownloader.git
cd tdownloader
```

### 2. Prepare TDLib Binary
The backend requires the native TDLib library (`tdjson.dll`, `libtdjson.dylib`, or `libtdjson.so`).
*   **Windows**: Download `tdjson.dll` and place it in `backend/`.
*   **macOS**: Download `libtdjson.dylib` and place it in `backend/`.
*   **Linux**: Download `libtdjson.so` and place it in `backend/`.

### 3. Configure Environment
Create a `.env` file in the **root** directory:
```env
API_ID=123456
API_HASH=abcdef1234567890
```

### 4. Install Dependencies
```bash
# Frontend
npm install

# Backend
cd backend
npm install
cd ..
```

### 5. Run the Application
Open two terminal tabs:

**Terminal 1 (Backend):**
```bash
cd backend
npm start
```

**Terminal 2 (Frontend):**
```bash
npm run dev
```

Visit `http://localhost:5173` in your browser.

---

## License

MIT