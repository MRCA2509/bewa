import subprocess
import sys
import os
import time


def run_dev():
    print("=" * 60)
    print(" STARTING BEWA LOGISTICS (BACKEND + FRONTEND) ")
    print("=" * 60)

    # 1. Start Backend (Flask)
    # Using 'python' or 'python3' depending on system
    backend_proc = subprocess.Popen(
        [sys.executable, "web/server.py"], stdout=None, stderr=None
    )
    print(">>> Backend started (Flask)")

    # 2. Start Frontend (Vite)
    frontend_dir = os.path.join(os.getcwd(), "web", "frontend")
    frontend_proc = subprocess.Popen(
        "npm run dev", cwd=frontend_dir, shell=True, stdout=None, stderr=None
    )
    print(">>> Frontend started (Vite)")
    print("=" * 60)
    print(">>> Opening browser in 5 seconds...")
    print("=" * 60)
    print("Press Ctrl+C to stop BOTH services at once.")
    print("=" * 60)

    # 3. Open browser after a short delay
    import webbrowser
    import threading

    def open_browser():
        time.sleep(5)
        webbrowser.open("http://localhost:5173")

    threading.Thread(target=open_browser, daemon=True).start()

    try:
        # Keep the main script running while processes are active
        while True:
            time.sleep(1)
            # Check if any process died unexpectedly
            if backend_proc.poll() is not None:
                print("!!! Backend process died. Check logs.")
                break
            if frontend_proc.poll() is not None:
                print("!!! Frontend process died. Check logs.")
                break
    except KeyboardInterrupt:
        print("\nShutting down BEWA Logistics...")
    finally:
        # Graceful shutdown
        backend_proc.terminate()
        frontend_proc.terminate()
        print("Done. All terminals closed.")


if __name__ == "__main__":
    run_dev()
