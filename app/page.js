"use client";
import React, { useEffect, useState } from "react";

export default function Home() {
  const [selectedRange, setSelectedRange] = useState("last30");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [summary, setSummary] = useState({ totalOrders: 0, totalRevenue: 0, ordersToFulfill: 0 });
  const [storeTable, setStoreTable] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedStore, setSelectedStore] = useState("all");
  const [displayedSummary, setDisplayedSummary] = useState({ totalOrders: 0, totalRevenue: 0, ordersToFulfill: 0 });
  const [orders, setOrders] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedStoreOrders, setSelectedStoreOrders] = useState([]);

  function formatRevenue(value) {
    const num = parseFloat(value);
    if (isNaN(num)) return '$0.00';
    return num.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  }

  useEffect(() => {
    loadAnalytics();
  }, [selectedRange, startDate, endDate]);

  useEffect(() => {
    updateDisplayedSummary();
  }, [selectedStore, summary, storeTable]);

  function getDates() {
    const now = new Date();
    let start, end = now;

    if (selectedRange === "today") {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (selectedRange === "thisWeek") {
      start = new Date(now);
      start.setDate(now.getDate() - 7);
    } else if (selectedRange === "thisMonth") {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (selectedRange === "thisYear") {
      start = new Date(now.getFullYear(), 0, 1);
    } else if (selectedRange === "last30") {
      start = new Date(now);
      start.setDate(now.getDate() - 30);
    } else if (selectedRange === "custom" && startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
    } else {
      // Default to last 30
      start = new Date(now);
      start.setDate(now.getDate() - 30);
    }

    return { start: start.toISOString(), end: end.toISOString() };
  }

  function updateDisplayedSummary() {
    if (selectedStore === "all") {
      setDisplayedSummary(summary);
    } else {
      const store = storeTable.find(s => s.brand === selectedStore);
      if (store) {
        setDisplayedSummary({
          totalOrders: store.totalOrders,
          totalRevenue: store.revenue,
          ordersToFulfill: store.totalOrders - store.fulfilled
        });
      }
    }
  }

  function handleOrdersClick() {
    if (selectedStore === "all") return;
    const storeOrders = orders.filter(order => order.store_name === selectedStore);
    setSelectedStoreOrders(storeOrders);
    setShowModal(true);
  }

  async function loadAnalytics() {
    setLoading(true);
    const { start, end } = getDates();
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

  return (
    <div className="container-fluid py-4" style={{ backgroundColor: "#f0f8f0", minHeight: "100vh" }}>
      <h1 className="mb-4 text-center" style={{ color: "#2c3e50", fontWeight: "bold" }}>📊 Shopify Orders Analytics Dashboard</h1>

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
                    value={selectedRange}
                    onChange={(e) => setSelectedRange(e.target.value)}
                  >
                    <option value="today">Today</option>
                    <option value="thisWeek">This Week</option>
                    <option value="thisMonth">This Month</option>
                    <option value="thisYear">This Year</option>
                    <option value="last30">Last 30 Days</option>
                    <option value="custom">Custom Date Range</option>
                  </select>
                </div>
                {selectedRange === "custom" && (
                  <>
                    <div className="col-md-3">
                      <input
                        type="date"
                        className="form-control"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                      />
                    </div>
                    <div className="col-md-3">
                      <input
                        type="date"
                        className="form-control"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
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
                value={selectedStore}
                onChange={(e) => setSelectedStore(e.target.value)}
              >
                <option value="all">All Stores</option>
                {storeTable.map((store, index) => (
                  <option key={index} value={store.brand}>{store.brand}</option>
                ))}
              </select>
            </div>
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
        <div className="col-md-4">
          <div className="card text-white bg-success shadow">
            <div className="card-body" >
              <h5 className="card-title">Total Orders</h5>
              <h2 className="card-text" style={{cursor: selectedStore !== 'all' ? 'pointer' : 'default'}} onClick={handleOrdersClick}>{displayedSummary.totalOrders}</h2>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card text-white bg-info shadow">
            <div className="card-body">
              <h5 className="card-title">Total Revenue</h5>
              <h2 className="card-text">{formatRevenue(displayedSummary.totalRevenue)}</h2>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card text-white bg-warning shadow">
            <div className="card-body">
              <h5 className="card-title">Orders to Be Fulfilled</h5>
              <h2 className="card-text">{displayedSummary.ordersToFulfill}</h2>
            </div>
          </div>
        </div>
      </div>

      {/* Store-wise Table */}
      <div className="card shadow" style={{ borderColor: "#28a745" }}>
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
                  <th>Fulfilled Orders</th>
                  <th>Partially Refunded Orders</th>
                  <th>Fully Refunded Orders</th>
                  <th>Cancelled Orders</th>
                  <th>Revenue</th>
                  {/* <th>Lost Amount</th> */}
                  {/* <th>Net Sales</th> */}
                </tr>
              </thead>
              <tbody>
                {storeTable.map((store, index) => (
                  <tr key={index}>
                    <td className="fw-bold">{store.brand}</td>
                    <td>{store.totalOrders}</td>
                    <td>{store.fulfilled}</td>
                    <td>{store.partiallyRefunded}</td>
                    <td>{store.fullyRefunded}</td>
                    <td>{store.cancelled}</td>
                    <td className="text-success fw-semibold">{formatRevenue(store.revenue)}</td>
                    {/* <td className="text-danger fw-semibold">{formatRevenue(store.lostAmount || 0)}</td> */}
                    {/* <td className="text-primary fw-semibold">{formatRevenue((store.revenue || 0) - (store.lostAmount || 0))}</td> */}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Orders Modal */}
      {showModal && (
        <>
          <div className="modal-backdrop fade show" onClick={() => setShowModal(false)}></div>
          <div className="modal fade show" style={{display: 'block'}} tabIndex="-1">
            <div className="modal-dialog modal-lg">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Orders for {selectedStore}</h5>
                  <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
                </div>
                <div className="modal-body" style={{maxHeight: '70vh', overflowY: 'auto'}}>
                  {selectedStoreOrders.map(order => {
                    return (
                      <div key={order.id} className="mb-3 p-3 border rounded">
                        <h6>
                          Order ID: {order.name}
                          {order.cancelled_at && <span className="badge bg-danger ms-2">Cancelled Order</span>}
                          {order.financial_status === 'partially_refunded' && (
                            <span className="badge bg-warning ms-2">Partially Refunded</span>
                          )}
                          {order.financial_status === 'refunded' && <span className="badge bg-secondary ms-2">Fully Refunded</span>}
                        </h6>
                        {order.line_items && order.line_items.map(item => (
                          <div key={item.id} className="d-flex align-items-center mb-2">
                            {item.image ? (
                              <img src={item.image.src} alt={item.title} style={{width: '50px', height: '50px', marginRight: '10px'}} />
                            ) : (
                              <div style={{width: '50px', height: '50px', marginRight: '10px', backgroundColor: '#f8f9fa', border: '1px solid #dee2e6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#6c757d', textAlign: 'center'}}>
                                {item.product_id ? 'No Image' : 'Custom Item'}
                              </div>
                            )}
                            <div>
                              {item.product_url ? (
                                <a href={item.product_url} target="_blank" rel="noopener noreferrer" style={{textDecoration: 'none', color: '#007bff'}}>
                                  <strong>{item.title}</strong>
                                </a>
                              ) : (
                                <strong style={{color: item.product_id ? '#6c757d' : '#495057'}}>
                                  {item.title}
                                  {!item.product_id && <small className="text-muted ms-1">(Custom Item)</small>}
                                </strong>
                              )}
                              {item.variant_title && <div>Variant: {item.variant_title}</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}