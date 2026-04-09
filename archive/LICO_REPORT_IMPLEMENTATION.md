# Lico-Bot Report Features - Implementation Plan for Bewa Logistics

## 📊 Lico-Bot Report Features Analysis

### ✅ Key Features Found

#### 1. **Summary Dashboard with Stats Cards**
- 4 stat cards showing:
  - Active AWB count
  - Drop Points count
  - Date range (Dari Tanggal - Sampai Tanggal)
- Performance Index chart (Bar chart)
- Total load indicator with color coding

#### 2. **Pivot Table / Heatmap Report**
- **Drop Point** sebagai row header
- **Dates** sebagai column headers
- **Heatmap color coding**:
  - Green = Good performance (>0, <50)
  - Orange = Warning (50-200)
  - Red = Bad performance (>200)
- **Expandable rows** (branch details)
- **Clickable cells** → Jump to tracking/database
- **Grand Total** row at bottom

#### 3. **Database Utama (Main Database)**
- Table columns:
  1. Waybill (clickable → tracking)
  2. Drop Point
  3. Waktu Sampai (date only)
  4. Jenis Scan
  5. Station Scan
  6. Status (badge: AKTIF/HISTORY)
  7. Reg Retur (🟠 indicator)
  8. Feedback (color-coded)
- **Filter support** (branch, category, date)
- **Clickable Waybill** → Jump to tracking

#### 4. **Tracking Paket**
- Search box for waybill lookup
- Detailed result with:
  - Package info (Waybill, Drop Point)
  - Last scan type
  - Status details grid:
    - Waktu Sampai
    - Jenis Scan
    - Station Scan
    - Waktu Scan
    - Status Pantau
    - Regis Retur
    - Feedback

#### 5. **Automation Center**
- Date picker for sync start date
- 4 action cards:
  - Login (Manual browser)
  - Full Sync
  - Download Monitor
  - Download Status
- Status logs display

#### 6. **Tools Status**
- Stats: Total Loaded / Total Failed
- Loaded tools list (green)
- Failed tools list (red) with error messages

---

## 🎯 Features to Implement in Bewa Logistics

### Priority 1: Enhanced Report Table

**File to modify:** `web/frontend/src/App.jsx`

**Features:**
1. **Heatmap-style report** with Drop Point vs Dates
2. **Color-coded cells** based on count
3. **Expandable rows** for branch details
4. **Clickable cells** → Filter database by date/branch
5. **Grand Total** row

**Implementation:**
```javascript
// New component: renderHeatmapReport()
const renderHeatmapReport = () => {
  // Group by Drop Point
  // Group by Date
  // Calculate counts per cell
  // Apply color coding:
  // - Green: 0-50
  // - Orange: 50-200
  // - Red: >200
}
```

### Priority 2: Improved Database Table

**Current:** Basic table with all columns
**Improved:** Like lico-bot with:
1. **Clickable Waybill** → Jump to tracking
2. **Status Badge** (AKTIF/HISTORY)
3. **Retur Indicator** (🟠)
4. **Feedback Column** (color-coded)
5. **Simplified columns** (8 key fields)

**Columns:**
1. Waybill ID (clickable)
2. Drop Point
3. Waktu Sampai (date only)
4. Jenis Scan
5. Station Scan
6. Status (badge)
7. Reg Retur (indicator)
8. Archive Reason (truncated)

### Priority 3: Enhanced Tracking

**Current:** Basic lookup
**Improved:** Like lico-bot with:
1. **Two-column layout** (Package Info | Status Details)
2. **Better visual hierarchy**
3. **Badge for Drop Point**
4. **Grid layout for status details**

### Priority 4: Stats Cards Enhancement

**Add to Dashboard:**
1. **Date Range Stats**
   - Earliest shipment date
   - Latest shipment date
2. **Drop Point Count**
3. **Active Days Count**

---

## 📝 Implementation Code

### 1. Heatmap Report Component

```javascript
const renderHeatmapReport = () => {
  const [dates, setDates] = useState([]);
  const [groupedData, setGroupedData] = useState([]);
  
  // Extract unique dates
  useEffect(() => {
    if (databaseData?.history) {
      const allDates = databaseData.history
        .map(row => row.waktu_sampai?.slice(0, 10))
        .filter(d => d)
        .sort()
        .slice(-7); // Last 7 days
      setDates([...new Set(allDates)]);
    }
  }, [databaseData]);
  
  // Group by Drop Point
  const grouped = databaseData?.history?.reduce((acc, row) => {
    const dp = row.drop_point || 'Unknown';
    if (!acc[dp]) acc[dp] = { total: 0, dates: {} };
    const date = row.waktu_sampai?.slice(0, 10);
    if (date) {
      acc[dp].dates[date] = (acc[dp].dates[date] || 0) + 1;
      acc[dp].total++;
    }
    return acc;
  }, {});
  
  const getCellClass = (val) => {
    if (!val || val === 0) return 'cell-val-0';
    if (val < 50) return 'cell-val-low';
    if (val < 200) return 'cell-val-mid';
    return 'cell-val-high';
  };
  
  return (
    <div className="card glass">
      <h3>Heatmap Report - Drop Point Performance</h3>
      <table className="heatmap-table">
        <thead>
          <tr>
            <th>Drop Point</th>
            {dates.map(d => <th key={d}>{d.slice(5)}</th>)}
            <th>TOTAL</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(grouped || {}).map(([dp, data]) => (
            <tr key={dp}>
              <td>{dp}</td>
              {dates.map(d => (
                <td 
                  key={d} 
                  className={getCellClass(data.dates[d])}
                  onClick={() => handleCellClick(dp, d, data.dates[d])}
                >
                  {data.dates[d] || 0}
                </td>
              ))}
              <td>{data.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

### 2. Improved Database Table

```javascript
const renderDatabaseImproved = () => (
  <div className="card glass">
    <div className="search-container">
      <Database size={20} color="#3b82f6" />
      <span>Database Utama ({databaseData?.history?.length || 0} records)</span>
    </div>
    
    <div className="report-table-container">
      <table className="data-grid">
        <thead>
          <tr>
            <th>Waybill</th>
            <th>Drop Point</th>
            <th>Waktu Sampai</th>
            <th>Jenis Scan</th>
            <th>Station Scan</th>
            <th>Status</th>
            <th>Retur</th>
            <th>Archive Reason</th>
          </tr>
        </thead>
        <tbody>
          {databaseData?.history?.map((row, i) => (
            <tr key={i}>
              <td 
                className="clickable-waybill"
                onClick={() => {
                  setSearchWaybill(row.waybill_id);
                  handleLookup();
                }}
                style={{color: '#3b82f6', fontWeight: 500, cursor: 'pointer'}}
              >
                {row.waybill_id || '-'}
              </td>
              <td>{row.drop_point || '-'}</td>
              <td>{(row.waktu_sampai || '').slice(0, 10)}</td>
              <td style={{fontSize: '0.75rem'}}>{row.jenis_scan || '-'}</td>
              <td style={{fontSize: '0.75rem'}}>{row.station_scan || '-'}</td>
              <td>
                <span className="badge badge-orange">HISTORY</span>
              </td>
              <td style={{textAlign: 'center'}}>
                {row.jenis_scan?.includes('Retur') ? '🟠' : '⚪'}
              </td>
              <td style={{
                fontSize: '0.7rem', 
                maxWidth: '200px', 
                overflow: 'hidden', 
                textOverflow: 'ellipsis', 
                whiteSpace: 'nowrap'
              }}>
                {row.archive_reason || '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);
```

### 3. Enhanced Tracking Display

```javascript
const renderTrackingEnhanced = () => (
  trackingResult && !trackingResult.error && (
    <div className="card glass animate-in" style={{borderLeft: '5px solid #3b82f6'}}>
      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem'}}>
        {/* Package Info */}
        <div>
          <h4 style={{color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase'}}>
            Informasi Paket
          </h4>
          <p style={{fontSize: '1.5rem', fontWeight: 'bold', margin: '0.5rem 0'}}>
            {trackingResult.waybill_id}
          </p>
          <div className="badge badge-blue">
            {trackingResult.drop_point || 'N/A'}
          </div>
          <div style={{marginTop: '1.5rem'}}>
            <p style={{fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.5rem'}}>
              Jenis Scan Terakhir:
            </p>
            <p style={{
              fontWeight: 600, 
              background: 'rgba(59,130,246,0.1)', 
              padding: '1rem', 
              borderRadius: '0.5rem'
            }}>
              {trackingResult.jenis_scan || 'Belum ada data'}
            </p>
          </div>
        </div>
        
        {/* Status Details */}
        <div>
          <h4 style={{color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '1.2rem'}}>
            Detail Status
          </h4>
          <div style={{display: 'flex', flexDirection: 'column', gap: '0.75rem'}}>
            {[
              ["Waktu Sampai", (trackingResult.waktu_sampai || '-').slice(0, 16)],
              ["Jenis Scan", trackingResult.jenis_scan || '-'],
              ["Station Scan", trackingResult.station_scan || '-'],
              ["Waktu Scan", (trackingResult.waktu_scan || '-').slice(0, 16)],
              ["Archive Reason", trackingResult.archive_reason || '-'],
            ].map(([label, val]) => (
              <div key={label} style={{
                display: 'flex', 
                justifyContent: 'space-between', 
                padding: '0.5rem', 
                borderRadius: '0.25rem', 
                background: 'rgba(255,255,255,0.03)'
              }}>
                <span>{label}</span>
                <span style={{fontWeight: 'bold'}}>{val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
);
```

---

## 🎨 CSS Additions (index.css)

```css
/* Heatmap Table */
.heatmap-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.heatmap-table th,
.heatmap-table td {
  padding: 0.5rem;
  border: 1px solid rgba(255, 255, 255, 0.05);
  text-align: center;
}

.heatmap-table th {
  background: #1e293b;
  color: #94a3b8;
  font-weight: 600;
}

/* Cell value colors */
.cell-val-0 { background: rgba(16, 185, 129, 0.1); color: #34d399; }
.cell-val-low { background: rgba(16, 185, 129, 0.2); color: #10b981; }
.cell-val-mid { background: rgba(245, 158, 11, 0.2); color: #f59e0b; }
.cell-val-high { background: rgba(239, 68, 68, 0.2); color: #ef4444; }

/* Interactive cells */
.interactive-cell {
  cursor: pointer;
  transition: all 0.2s;
}

.interactive-cell:hover {
  transform: scale(1.05);
  filter: brightness(1.2);
}

/* Data Grid (Lico-bot style) */
.data-grid {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.data-grid th,
.data-grid td {
  padding: 0.75rem;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.data-grid th {
  background: #1e293b;
  color: #94a3b8;
  font-weight: 600;
  text-transform: uppercase;
  font-size: 0.75rem;
  position: sticky;
  top: 0;
  z-index: 20;
}

.clickable-waybill {
  color: #3b82f6 !important;
  font-weight: 500 !important;
  cursor: pointer !important;
  text-decoration: underline !important;
}

.clickable-waybill:hover {
  color: #60a5fa !important;
}

/* Report table container */
.report-table-container {
  overflow: auto;
  max-height: 70vh;
  border-radius: 0.5rem;
  border: 1px solid var(--glass-border);
}
```

---

## 📋 Implementation Checklist

- [ ] Add heatmap report component
- [ ] Add date grouping logic
- [ ] Add color-coded cells
- [ ] Add clickable cells → filter database
- [ ] Improve database table (8 columns)
- [ ] Add clickable waybill → tracking
- [ ] Add status badges
- [ ] Add retur indicator
- [ ] Enhance tracking display (2-column grid)
- [ ] Add CSS for heatmap and data grid
- [ ] Add stats cards (date range, drop point count)

---

**Ready to implement:** Yes
**Priority:** High (user requested)
**Estimated time:** 2-3 hours
