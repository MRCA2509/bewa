# Test Encoding Fix

Run this to test if encoding is working:

```bash
cd C:\Users\User\Pictures\bewa
start.bat
```

If you see any errors, try:

```bash
# Set UTF-8 encoding
chcp 65001

# Then run
python web/server.py
```

## Fixed Files

All Python and Batch files now have UTF-8 encoding support:

- ✅ `web/server.py` - Added sys.stdout UTF-8 wrapper
- ✅ `main.py` - Added sys.stdout UTF-8 wrapper  
- ✅ `start.bat` - Added `chcp 65001`
- ✅ `run.bat` - Added `chcp 65001`
- ✅ `start_mysql.bat` - Added `chcp 65001`
- ✅ `verify_mysql.bat` - Added `chcp 65001`
- ✅ `web/install.bat` - Added `chcp 65001`
- ✅ `web/run_web.bat` - Added `chcp 65001`
