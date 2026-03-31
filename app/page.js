"use client";
import React, { useEffect, useState } from "react";
import { DateTime } from 'luxon';

export default function Home() {
  const [selectedRange, setSelectedRange] = useState("last30");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [summary, setSummary] = useState({ totalOrders: 0, totalRevenue: 0, ordersToFulfill: 0, amountRefunded: 0, netSales: 0 });
  const [storeTable, setStoreTable] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedStore, setSelectedStore] = useState("all");
  const [displayedSummary, setDisplayedSummary] = useState({ totalOrders: 0, totalRevenue: 0, ordersToFulfill: 0, amountRefunded: 0, netSales: 0 });
  const [orders, setOrders] = useState([]);
  // Filtered views for restricted users (e.g. yasir.khan@arcinventador.com)
  const [filteredStoreTable, setFilteredStoreTable] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedStoreOrders, setSelectedStoreOrders] = useState([]);
  const [modalType, setModalType] = useState(""); // 'partial_refund' | 'full_refund' | 'cancelled'
  const [modalStore, setModalStore] = useState("");
  const [modalOrdersData, setModalOrdersData] = useState([]);
  const [modalLoading, setModalLoading] = useState(false);

  // Simple client-side auth to protect the dashboard until correct credentials entered
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  // Allowed credentials: add objects with `email` and `password` to permit access
  const allowedCredentials = [
    { email: 'haris@arcinventador.com', password: 'autelecom123' },
    { email: 'yasir.khan@arcinventador.com', password: 'autelecom123' },
    { email: 'awais@arcinventador.com', password: 'autelecom123' },
    // Example: { email: 'other@example.com', password: 'anotherPass' },
  ];
  // Store which allowed email successfully authenticated (empty when not logged in)
  const [authenticatedEmail, setAuthenticatedEmail] = useState("");

  // Pending filter values (local until Apply Filter clicked)
  const [pendingRange, setPendingRange] = useState(selectedRange);
  const [pendingStartDate, setPendingStartDate] = useState(startDate);
  const [pendingEndDate, setPendingEndDate] = useState(endDate);
  const [pendingStore, setPendingStore] = useState(selectedStore);

  function formatRevenue(value) {
    const num = parseFloat(value);
    if (isNaN(num)) return '$0.00';
    return num.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  }

  // Load analytics only after successful authentication
  useEffect(() => {
    if (isAuthenticated) {
      loadAnalytics();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    updateDisplayedSummary();
  }, [selectedStore, summary, storeTable]);

  // Recompute filtered views when orders/storeTable or authenticated user changes
  useEffect(() => {
    if (authenticatedEmail === 'yasir.khan@arcinventador.com') {
      const fo = orders.filter(isGenuineJacketOrder);
      setFilteredOrders(fo);
      setFilteredStoreTable(aggregateStoreTableFromOrders(storeTable, fo));
    } else {
      setFilteredOrders([]);
      setFilteredStoreTable([]);
    }
  }, [orders, storeTable, authenticatedEmail]);

  function getDates(rangeOverride, startOverride, endOverride) {
    const range = rangeOverride ?? selectedRange;
    const startDateVal = startOverride ?? startDate;
    const endDateVal = endOverride ?? endDate;

    // Use America/Chicago timezone for all calculations
    const tz = 'America/Chicago';
    let startDt, endDt;

    if (range === 'today') {
      const nowChi = DateTime.now().setZone(tz);
      startDt = nowChi.startOf('day');
      endDt = nowChi.endOf('day');
    } else if (range === 'thisWeek') {
      // keep original semantics: last 7 days (relative to Chicago)
      const nowChi = DateTime.now().setZone(tz);
      startDt = nowChi.minus({ days: 7 }).startOf('day');
      endDt = nowChi.endOf('day');
    } else if (range === 'thisMonth') {
      const nowChi = DateTime.now().setZone(tz);
      startDt = nowChi.startOf('month');
      endDt = nowChi.endOf('month');
    } else if (range === 'thisYear') {
      const nowChi = DateTime.now().setZone(tz);
      startDt = nowChi.startOf('year');
      endDt = nowChi.endOf('year');
    } else if (range === 'last30') {
      const nowChi = DateTime.now().setZone(tz);
      startDt = nowChi.minus({ days: 30 }).startOf('day');
      endDt = nowChi.endOf('day');
    } else if (range === 'custom' && startDateVal && endDateVal) {
      // Interpret custom dates as YYYY-MM-DD in America/Chicago timezone
      startDt = DateTime.fromISO(startDateVal, { zone: tz }).startOf('day');
      endDt = DateTime.fromISO(endDateVal, { zone: tz }).endOf('day');
    } else {
      // default to last 30 days
      const nowChi = DateTime.now().setZone(tz);
      startDt = nowChi.minus({ days: 30 }).startOf('day');
      endDt = nowChi.endOf('day');
    }

    // Convert to UTC ISO strings so Shopify API receives proper UTC timestamps
    return { start: startDt.toUTC().toISO(), end: endDt.toUTC().toISO() };
  }

  function updateDisplayedSummary() {
    const effectiveStoreTable = (authenticatedEmail === 'yasir.khan@arcinventador.com' && filteredStoreTable.length) ? filteredStoreTable : storeTable;
    if (selectedStore === "all") {
      // Use server-provided values when available, otherwise compute from effectiveStoreTable
      let amountRefunded = summary.amountRefunded;
      let netSales = summary.netSales;
      if (typeof amountRefunded === 'undefined' || typeof netSales === 'undefined') {
        const totalLost = effectiveStoreTable.reduce((s, st) => s + (parseFloat(st.lostAmount || 0) || 0), 0);
        const totalRevenue = effectiveStoreTable.reduce((s, st) => s + (parseFloat(st.revenue || 0) || 0), 0);
        amountRefunded = totalLost;
        netSales = totalRevenue - totalLost;
      }
      setDisplayedSummary({ ...summary, amountRefunded, netSales });
    } else {
      const store = effectiveStoreTable.find(s => s.brand === selectedStore);
      if (store) {
        setDisplayedSummary({
          totalOrders: store.totalOrders,
          totalRevenue: store.revenue,
          // prefer the server-provided per-store ordersToFulfill, fallback to a safe calculation
          ordersToFulfill: (typeof store.ordersToFulfill !== 'undefined') ? store.ordersToFulfill : Math.max(0, store.totalOrders - store.fulfilled),
          amountRefunded: store.lostAmount || 0,
          netSales: (store.revenue || 0) - (store.lostAmount || 0)
        });
      }
    }
  }

  function handleOrdersClick() {
    if (selectedStore === "all") return;
    // Open the reusable modal showing all orders for the selected store
    handleOpenModal(selectedStore, 'orders');
  }

  function handleLoginSubmit(e) {
    e.preventDefault();
    // Check entered credentials against the allowed credentials array
    const isValid = allowedCredentials.some(c => c.email === loginEmail && c.password === loginPassword);
    if (isValid) {
      setLoginError("");
      setIsAuthenticated(true);
      setAuthenticatedEmail(loginEmail);
    } else {
      setLoginError('Invalid email or password');
    }
  }

  function handleUnfulfilledOrdersClick() {
    if (selectedStore === "all") return;
    // Open the modal showing only unfulfilled active orders for the selected store
    handleOpenModal(selectedStore, 'unfulfilled');
  }

  // function formatDate(dateStr) {
  //   if (!dateStr) return "N/A";
  //   const d = new Date(dateStr);
  //   return d.toLocaleString();
  // }
  function formatDate(dateStr) {
  if (!dateStr) return "N/A";

  const d = new Date(dateStr);

  return d.toLocaleString("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

  function computeRefundAmount(order) {
    if (!order) return 0;
    if (order.total_refunded) return parseFloat(order.total_refunded) || 0;
    if (order.refunds && order.refunds.length) {
      const total = order.refunds.reduce((sum, r) => {
        if (r.transactions && r.transactions.length) {
          return sum + r.transactions.reduce((s, t) => s + (parseFloat(t.amount || 0) || 0), 0);
        } else if (r.amount) {
          return sum + parseFloat(r.amount || 0);
        }
        return sum;
      }, 0);
      return total;
    }
    return 0;
  }

  function isGenuineJacketOrder(order) {
    if (!order || !order.line_items) return false;
    return order.line_items.some(item => {
      const title = (item.title || "").toString().toLowerCase();
      return title.includes('genuine jacket');
    });
  }

  function aggregateStoreTableFromOrders(baseStores, ordersList) {
    const map = {};
    ordersList.forEach(o => {
      const brand = o.store_name || o.source_name || 'unknown';
      if (!map[brand]) {
        map[brand] = { brand, totalOrders: 0, fulfilled: 0, partiallyRefunded: 0, cancelled: 0, revenue: 0, lostAmount: 0 };
      }
      const entry = map[brand];
      entry.totalOrders += 1;
      const fulfillmentStatus = o.fulfillment_status;
      if (fulfillmentStatus === 'fulfilled' || (o.fulfillments && o.fulfillments.length > 0)) entry.fulfilled += 1;
      if (o.financial_status === 'partially_refunded') entry.partiallyRefunded += 1;
      if (o.cancelled_at || o.cancelled || o.cancel_reason) entry.cancelled += 1;
      const total = parseFloat(o.total_price || o.total || 0) || 0;
      entry.revenue += total;
      entry.lostAmount += computeRefundAmount(o) || 0;
    });

    const result = [];
    baseStores.forEach(bs => {
      if (map[bs.brand]) {
        const m = map[bs.brand];
        result.push({ brand: bs.brand, totalOrders: m.totalOrders, fulfilled: m.fulfilled, partiallyRefunded: m.partiallyRefunded, cancelled: m.cancelled, revenue: m.revenue, lostAmount: m.lostAmount });
      } else {
        result.push({ brand: bs.brand, totalOrders: 0, fulfilled: 0, partiallyRefunded: 0, cancelled: 0, revenue: 0, lostAmount: 0 });
      }
    });
    return result;
  }

  function isActiveOrder(order) {
    const isCancelled = !!order.cancelled_at;
    const isPartiallyRefunded = order.financial_status === 'partially_refunded';
    const isFullyRefunded = order.financial_status === 'refunded';
    const isPaid = order.financial_status === 'paid';
    return isPaid && !isCancelled && !isPartiallyRefunded && !isFullyRefunded;
  }

  function handleOpenModal(storeName, type) {
    setModalType(type);
    setModalStore(storeName);
    setShowModal(true);
    setModalLoading(true);
    // Simulate a small fetch/delay while filtering
    setTimeout(() => {
      const baseOrders = (authenticatedEmail === 'yasir.khan@arcinventador.com' && filteredOrders.length) ? filteredOrders : orders;
      let filtered = baseOrders.filter(o => o.store_name === storeName);
      if (type === 'partial_refund') {
        filtered = filtered.filter(o => o.financial_status === 'partially_refunded');
      } else if (type === 'full_refund') {
        filtered = filtered.filter(o => o.financial_status === 'refunded');
      } else if (type === 'cancelled') {
        filtered = filtered.filter(o => o.cancelled_at || o.cancelled || o.cancel_reason);
      } else if (type === 'fulfilled') {
        // Orders with fulfillment status 'fulfilled' AND that are active (not refunded or cancelled)
        filtered = filtered.filter(o => (o.fulfillment_status === 'fulfilled' || (o.fulfillments && o.fulfillments.length > 0)) && isActiveOrder(o));
      } else if (type === 'unfulfilled') {
        // Orders with fulfillment status NOT 'fulfilled' AND that are active (not refunded or cancelled)
        filtered = filtered.filter(o => o.fulfillment_status !== 'fulfilled' && isActiveOrder(o));
      }
      setModalOrdersData(filtered);
      setModalLoading(false);
    }, 150);
  }

  async function loadAnalytics({ range, start: sDate, end: eDate } = {}) {
    setLoading(true);
    const { start, end } = getDates(range, sDate, eDate);
    try {
      const res = await fetch(`/api/analytics?start_date=${start}&end_date=${end}`);
      const data = await res.json();
      setSummary(data.summary);
      setStoreTable(data.storeTable);
      setOrders(data.orders);
    } catch (err) {
      console.error("Failed to load analytics:", err);
    }
    setLoading(false);
  }

  function applyFilters() {
    if (loading) return;
    const changed = pendingRange !== selectedRange || pendingStartDate !== startDate || pendingEndDate !== endDate || pendingStore !== selectedStore;
    if (!changed) return;

    // Update applied filters (for UI and summary) and fetch with the pending values
    setSelectedRange(pendingRange);
    setStartDate(pendingStartDate);
    setEndDate(pendingEndDate);
    setSelectedStore(pendingStore);

    loadAnalytics({ range: pendingRange, start: pendingStartDate, end: pendingEndDate });
  }

  function resetFilters() {
    if (loading) return;
    const defaultRange = 'last30';
    const defaultStart = '';
    const defaultEnd = '';
    const defaultStore = 'all';

    setPendingRange(defaultRange);
    setPendingStartDate(defaultStart);
    setPendingEndDate(defaultEnd);
    setPendingStore(defaultStore);

    setSelectedRange(defaultRange);
    setStartDate(defaultStart);
    setEndDate(defaultEnd);
    setSelectedStore(defaultStore);

    loadAnalytics();
  }

  const contentStyle = !isAuthenticated ? { filter: 'blur(6px)', pointerEvents: 'none', userSelect: 'none' } : {};

  // Effective (possibly filtered) data for the UI — restricted users see reduced views
  const effectiveStoreTable = (authenticatedEmail === 'yasir.khan@arcinventador.com' && filteredStoreTable.length) ? filteredStoreTable : storeTable;
  const effectiveOrders = (authenticatedEmail === 'yasir.khan@arcinventador.com' && filteredOrders.length) ? filteredOrders : orders;

  return (
    <>
      {/* Login modal - blocks access until authenticated */}
      {!isAuthenticated && (
        <>
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 2000 }}></div>
          <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2010 }}>
            <div className="card p-4 shadow" style={{ width: 380 }}>
              <h5 className="mb-3">CRM Login</h5>
              <form onSubmit={handleLoginSubmit}>
                <div className="mb-2">
                  <label className="form-label">Email</label>
                  <input autoFocus type="email" className="form-control" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} />
                </div>
                <div className="mb-3">
                  <label className="form-label">Password</label>
                  <input type="password" className="form-control" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} />
                </div>
                {loginError && <div className="text-danger mb-3">{loginError}</div>}
                <div className="d-flex justify-content-end">
                  <button className="btn btn-primary" type="submit">Login</button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}

      <div className="container-fluid py-4" style={{ ...contentStyle, backgroundColor: "#f0f8f0", minHeight: "100vh" }}>
      <h1 className="mb-4 text-center" style={{ color: "#2c3e50", fontWeight: "bold" }}>Shopify Orders Analytics Dashboard</h1>

      {/* Date Filter */}
      <div className="row justify-content-center mb-4">
        <div className="col-md-8 col-lg-6">
          <div className="card shadow-sm" style={{ borderColor: "#28a745" }}>
            <div className="card-body">
              <h5 className="card-title" style={{ color: "#28a745" }}>Select Date Range</h5>
              <div className="row g-3">
                <div className="col-md-6">
                  <select
                    className="form-select"
                    value={pendingRange}
                    onChange={(e) => setPendingRange(e.target.value)}
                  >
                    <option value="today">Today test</option>
                    <option value="thisWeek">This Week</option>
                    <option value="thisMonth">This Month</option>
                    <option value="thisYear">This Year</option>
                    <option value="last30">Last 30 Days</option>
                    <option value="custom">Custom Date Range</option>
                  </select>
                </div>
                {pendingRange === "custom" && (
                  <>
                    <div className="col-md-3">
                      <input
                        type="date"
                        className="form-control"
                        value={pendingStartDate}
                        onChange={(e) => setPendingStartDate(e.target.value)}
                      />
                    </div>
                    <div className="col-md-3">
                      <input
                        type="date"
                        className="form-control"
                        value={pendingEndDate}
                        onChange={(e) => setPendingEndDate(e.target.value)}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
        {/* Store Selector */}
         <div className="col-md-6 col-lg-4">
          <div className="card shadow-sm" style={{ borderColor: "#28a745" }}>
            <div className="card-body">
              <h5 className="card-title" style={{ color: "#28a745" }}>Select Store</h5>
              <select
                className="form-select"
                value={pendingStore}
                onChange={(e) => setPendingStore(e.target.value)}
              >
                <option value="all">All Stores</option>
                {effectiveStoreTable.map((store, index) => (
                  <option key={index} value={store.brand}>{store.brand}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Apply/Reset Buttons */}
        <div className="col-md-12 col-lg-2 d-flex align-items-center">
          <div>
            <button className="btn btn-success me-2" onClick={() => applyFilters()} disabled={loading || !(pendingRange !== selectedRange || pendingStartDate !== startDate || pendingEndDate !== endDate || pendingStore !== selectedStore)}>
              {loading ? 'Applying...' : 'Apply Filter'}
            </button>
            <button className="btn btn-outline-secondary" onClick={() => resetFilters()} disabled={loading}>
              Reset Filters
            </button>
          </div>
        </div>
      </div>


      {loading && (
        <div className="text-center mb-4">
          <div className="spinner-border text-success" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="row mb-4 g-4">
        <div className="col-6 col-md-2">
          <div className="card text-black shadow bg-sky">
            <div className="card-body" >
              <h5 className="card-title">Total Orders</h5>
              <h2 className="card-text" style={{cursor: selectedStore !== 'all' ? 'pointer' : 'default'}} onClick={handleOrdersClick}><b>{displayedSummary.totalOrders}</b></h2>
            </div>
          </div>
        </div>
        <div className="col-6 col-md-2">
          <div className="card text-black bg-purple shadow">
            <div className="card-body">
              <h5 className="card-title">Total Revenue</h5>
              <h2 className="card-text"><b>{formatRevenue(displayedSummary.totalRevenue)}</b></h2>
            </div>
          </div>
        </div>
        <div className="col-6 col-md-2">
          <div className="card text-black bg-pink shadow">
            <div className="card-body">
              <h5 className="card-title">Orders to Be Fulfilled</h5>
              <h2 className="card-text" style={{cursor: selectedStore !== 'all' ? 'pointer' : 'default'}} onClick={handleUnfulfilledOrdersClick}><b>{displayedSummary.ordersToFulfill}</b></h2>
            </div>
          </div>
        </div>
        <div className="col-6 col-md-2">
          <div className="card text-black bg-ornage shadow">
            <div className="card-body">
              <h5 className="card-title">Amount Refunded</h5>
              <h2 className="card-text"><b>{formatRevenue(displayedSummary.amountRefunded)}</b> </h2>
            </div>
          </div>
        </div>
        <div className="col-6 col-md-2">
          <div className="card text-black bg-yellow shadow">
            <div className="card-body">
              <h5 className="card-title">Net Sales</h5>
              <h2 className="card-text"><b>{formatRevenue(displayedSummary.netSales)}</b></h2>
            </div>
          </div>
        </div>
      </div>

      {/* Store-wise Table */}
      <div className="card shadow" style={{ borderColor: "#28a745" }} id="table_filterd">
        <div className="card-header" style={{ backgroundColor: "#d4edda", color: "#155724" }}>
          <h5 className="mb-0">Store / Brand-Wise Analytics</h5>
        </div>
        <div className="card-body">
          <div className="table-responsive">
            <table className="table table-striped table-hover">
              <thead style={{ backgroundColor: "#28a745", color: "white" }}>
                <tr>
                  <th>Brand</th>
                  <th>Orders</th>
                  <th>Fulfilled</th>
                  <th>Partially <br></br>Refunded</th>
                  {/* <th>Fully <br></br> Refunded</th> */}
                  <th>Cancelled</th>
                  <th>Revenue</th>
                   <th>Amount <br></br>Refunded</th>
                   <th>Net Sales</th>
                </tr>
              </thead>
              <tbody>
                {effectiveStoreTable.map((store, index) => (
                  <tr key={index}>
                    <td className="fw-bold">{store.brand}</td>
                    <td>
                      {store.totalOrders > 0 ? (
                        <button className="btn btn-link p-0 text-decoration-none" onClick={() => handleOpenModal(store.brand, 'orders')}>
                          {store.totalOrders}
                        </button>
                      ) : (
                        <span>{store.totalOrders}</span>
                      )}
                    </td>
                    <td>
                      {store.fulfilled > 0 ? (
                        <button className="btn btn-link p-0 text-decoration-none" onClick={() => handleOpenModal(store.brand, 'fulfilled')}>
                          {store.fulfilled}
                        </button>
                      ) : (
                        <span>{store.fulfilled}</span>
                      )}
                    </td>
                    <td>
                      {store.partiallyRefunded > 0 ? (
                        <button className="btn btn-link p-0 text-decoration-none" onClick={() => handleOpenModal(store.brand, 'partial_refund')}>
                          {store.partiallyRefunded}
                        </button>
                      ) : (
                        <span>{store.partiallyRefunded}</span>
                      )}
                    </td>
                    {/* <td>
                      {store.fullyRefunded > 0 ? (
                        <button className="btn btn-link p-0 text-decoration-none" onClick={() => handleOpenModal(store.brand, 'full_refund')}>
                          {store.fullyRefunded}
                        </button>
                      ) : (
                        <span>{store.fullyRefunded}</span>
                      )}
                    </td> */}
                    <td>
                      {store.cancelled > 0 ? (
                        <button className="btn btn-link p-0 text-decoration-none text-danger" onClick={() => handleOpenModal(store.brand, 'cancelled')}>
                          {store.cancelled}
                        </button>
                      ) : (
                        <span>{store.cancelled}</span>
                      )}
                    </td>
                    <td className="text-success fw-semibold">{formatRevenue(store.revenue)}</td>
                     <td className="text-danger fw-semibold">{formatRevenue(store.lostAmount || 0)}</td>
                    <td className="text-primary fw-semibold">{formatRevenue((store.revenue || 0) - (store.lostAmount || 0))}</td>
                  </tr> 
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Orders Modal (Reusable) */}
      {showModal && (
        <>
          <div className="modal-backdrop fade show" onClick={() => setShowModal(false)}></div>
          <div className="modal fade show" style={{display: 'block'}} tabIndex="-1">
            <div className="modal-dialog modal-lg">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">{modalType === 'partial_refund' ? 'Partially Refunded Orders' : modalType === 'full_refund' ? 'Fully Refunded Orders' : modalType === 'cancelled' ? 'Cancelled Orders' : modalType === 'fulfilled' ? 'Fulfilled Orders' : modalType === 'unfulfilled' ? 'Orders to Be Fulfilled' : 'Orders'} for {modalStore}</h5>
                  <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
                </div>
                <div className="modal-body" style={{maxHeight: '70vh', overflowY: 'auto'}}>
                  {modalLoading ? (
                    <div className="text-center py-4">
                      <div className="spinner-border text-success" role="status">
                        <span className="visually-hidden">Loading...</span>
                      </div>
                    </div>
                  ) : modalOrdersData.length === 0 ? (
                    <div className="text-center py-4 text-muted">No records found for this selection.</div>
                  ) : (
                    modalOrdersData.map(order => (
                      <div key={order.id} className="mb-3 p-3 border rounded">
                        <div className="d-flex justify-content-between align-items-start">
                          <div>
                            <h6><b>Order ID: {order.name}</b></h6>
                            <div className="text-muted">Date: {formatDate(order.created_at || order.processed_at || order.updated_at)}</div>
                          </div>
                          <div className="text-end">
                            {(modalType === 'partial_refund' || modalType === 'full_refund') && (
                              <div><strong>Refunded:</strong> {formatRevenue(computeRefundAmount(order) || 0)}</div>
                            )}
                            {modalType === 'cancelled' && (
                              <div><strong>Cancellation Reason:</strong> {order.cancel_reason || order.cancel_reason || 'N/A'}</div>
                            )}
                          </div>
                        </div>

                        <div>
                          {(() => {
                            let displayItems = [];
                            if (modalType === 'fulfilled' && order.line_items) {
                              displayItems = order.line_items.filter(i => i.fulfillment_status === 'fulfilled');
                            } else if (modalType === 'unfulfilled' && order.line_items) {
                              displayItems = order.line_items.filter(i => i.fulfillment_status !== 'fulfilled');
                            } else {
                              displayItems = order.line_items || [];
                            }

                            if ((modalType === 'fulfilled' || modalType === 'unfulfilled') && displayItems.length === 0) {
                              return <div className="text-muted">No {modalType === 'fulfilled' ? 'fulfilled' : 'unfulfilled'} products for this order.</div>;
                            }
                            return displayItems.map(item => (
                              <div key={item.id} className="d-flex gap-2 align-items-center mt-2">
                                {item.image ? (
                                  <img src={item.image.src} alt={item.title} style={{width: '50px', height: '50px', objectFit: 'cover', borderRadius: '4px'}} />
                                ) : (
                                  <div style={{width: '50px', height: '50px', backgroundColor: '#f8f9fa', border: '1px solid #dee2e6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#6c757d'}}>
                                    No Image
                                  </div>
                                )}
                                <div>
                                  {item.product_url ? (
                                    <a href={item.product_url} target="_blank" rel="noopener noreferrer" style={{textDecoration: 'none', color: '#007bff'}}>
                                      <strong>{item.title}</strong>
                                    </a>
                                  ) : (
                                    <strong>{item.title}</strong>
                                  )}
                                  <div className="text-muted">x {item.quantity} {item.variant_title && <span>Variant: {item.variant_title}</span>}</div>
                                </div>
                              </div>
                            ));
                          })()}
                        </div>

                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
    </>
  );
}