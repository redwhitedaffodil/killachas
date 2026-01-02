import asyncio
import os
import glob
import sys
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# --- CONFIGURATION ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ENGINES_DIR = os.path.join(BASE_DIR, "engines")
PORT = 8000

app = FastAPI()
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

class EngineManager:
    def __init__(self):
        self.active_process = None
        self.active_engine_name = "None"
        self.available_engines = {}
        self.clients = set()
        self.reader_task = None

    def scan_engines(self):
        self.available_engines = {}

        # --- FIX: SMART OS DETECTION ---
        if os.name == 'nt':  # Windows
            # Strictly look for .exe files on Windows to avoid opening "README" or "License" files
            search_pattern = os.path.join(ENGINES_DIR, "*", "*.exe")
            found_files = glob.glob(search_pattern)
        else:  # Linux / Mac
            # Look for files with no extension or executable permissions
            # This is a broad search, but we filter out common non-binaries
            search_pattern = os.path.join(ENGINES_DIR, "*", "*")
            found_files = [f for f in glob.glob(search_pattern) if "." not in os.path.basename(f) or os.access(f, os.X_OK)]

        for file_path in found_files:
            if os.path.isdir(file_path): continue

            # Double check: Skip common text files just in case
            filename = os.path.basename(file_path).lower()
            if filename.startswith("readme") or filename.startswith("license") or filename.endswith(".txt"):
                continue

            folder_name = os.path.basename(os.path.dirname(file_path))
            # If multiple exes exist, this keeps the last one found.
            # Ideally, have only one .exe per folder.
            self.available_engines[folder_name] = file_path

        print(f"Found engines: {list(self.available_engines.keys())}")
        return self.available_engines

    async def broadcast(self, message):
        for client in list(self.clients):
            try:
                await client.send_text(message)
            except:
                self.clients.discard(client)

    async def _read_engine_output(self):
        try:
            while self.active_process:
                if self.active_process.stdout.at_eof():
                    break
                line = await self.active_process.stdout.readline()
                if line:
                    decoded = line.decode().strip()
                    # Pass through vital UCI info
                    if (decoded.startswith("bestmove") or
                        decoded.startswith("info") or
                        decoded.startswith("readyok") or
                        decoded.startswith("uciok") or
                        decoded.startswith("option") or
                        decoded.startswith("id")):
                        await self.broadcast(decoded)
        except Exception as e:
            print(f"Reader Error: {e}")

    async def load_engine(self, engine_name):
        if engine_name not in self.available_engines:
            print(f"Engine {engine_name} not found in available list.")
            return False

        # 1. KILL EXISTING
        if self.active_process:
            print(f"Killing {self.active_engine_name}...")
            try:
                self.active_process.terminate()
                await self.active_process.wait()
            except:
                try: self.active_process.kill()
                except: pass

            if self.reader_task:
                self.reader_task.cancel()
                try: await self.reader_task
                except asyncio.CancelledError: pass

        # 2. START NEW
        exe_path = self.available_engines[engine_name]

        # Verify file still exists and is file
        if not os.path.isfile(exe_path):
            print(f"Error: Engine path is not a file: {exe_path}")
            return False

        try:
            print(f"Attempting to launch: {exe_path}")
            self.active_process = await asyncio.create_subprocess_exec(
                exe_path,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            self.active_engine_name = engine_name
            print(f"Switched to: {engine_name}")

            # 3. RESTART READER
            self.reader_task = asyncio.create_task(self._read_engine_output())

            # 4. INITIALIZE
            await self.send_command("uci")
            await self.send_command("isready")
            return True
        except OSError as e:
            if e.winerror == 193:
                print(f"CRITICAL ERROR: '{exe_path}' is not a valid executable.")
                print("Make sure you only have the engine .exe file in the folder, or that your engine matches your Windows version (64-bit vs 32-bit).")
            else:
                print(f"OS Error launching engine: {e}")
            return False
        except Exception as e:
            print(f"Failed to load engine: {e}")
            return False

    async def send_command(self, cmd):
        if self.active_process and self.active_process.stdin:
            try:
                self.active_process.stdin.write(f"{cmd}\n".encode())
                await self.active_process.stdin.drain()
            except: pass

manager = EngineManager()

@app.on_event("startup")
async def startup_event():
    engines = manager.scan_engines()
    if engines:
        # Load the first found engine by default
        await manager.load_engine(list(engines.keys())[0])
    else:
        print("WARNING: No engines found in 'engines/' folder!")

# --- API ---
@app.get("/list_engines")
async def list_engines():
    manager.scan_engines()
    return {"engines": list(manager.available_engines.keys()), "active": manager.active_engine_name}

@app.get("/set_engine/{name}")
async def set_engine(name: str):
    success = await manager.load_engine(name)
    if success:
        return {"status": "ok", "active": manager.active_engine_name}
    return {"status": "error", "message": "Failed to load engine"}

@app.get("/health")
async def health():
    return {"status": "online"}

# --- WEBSOCKET ---
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    manager.clients.add(websocket)
    if manager.active_engine_name:
         await websocket.send_text(f"info string Connected to {manager.active_engine_name}")
    try:
        while True:
            data = await websocket.receive_text()
            await manager.send_command(data)
    except WebSocketDisconnect:
        manager.clients.discard(websocket)

if __name__ == "__main__":
    uvicorn.run(app, host="localhost", port=PORT)
