import urllib.request
import json

try:
    req = urllib.request.urlopen("http://localhost:5000/api/report/database")
    res = json.loads(req.read().decode())
    active = res["data"]["active"]
    print("Found {} active shipments".format(len(active)))
    if active:
        row = active[0]
        print("waktu_sampai type:", type(row.get("waktu_sampai")))
        print("waktu_regis_retur type:", type(row.get("waktu_regis_retur")))
        print("Sample row:")
        print(json.dumps(row, indent=2))
except Exception as e:
    print("Error:", e)
