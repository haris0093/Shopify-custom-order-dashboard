"use client";
import React, { useEffect, useState } from "react";

export default function Home() {
  const [selectedRange, setSelectedRange] = useState("last30");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [summary, setSummary] = useState({ totalOrders: 0, totalRevenue: 0, ordersToFulfill: 0 });
  const [storeTable, setStoreTable] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadAnalytics();
  }, [selectedRange, startDate, endDate]);

  function getDates() {
    const now = new Date();
    let start, end = now;

    if (selectedRange === "today") {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (selectedRange === "last7") {
      start = new Date(now);
      start.setDate(now.getDate() - 7);
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

  async function loadAnalytics() {
    setLoading(true);
    const { start, end } = getDates();
    try {
      const res = await fetch(`/api/analytics?start_date=${start}&end_date=${end}`);
      const data = await res.json();
      setSummary(data.summary);
      setStoreTable(data.storeTable);
    } catch (err) {
      console.error("Failed to load analytics:", err);
    }
    setLoading(false);
  }

  return (
    <div className="container-fluid py-4" style={{ backgroundColor: "#f0f8f0", minHeight: "100vh" }}>
      <h1 className="mb-4 text-center" style={{ color: "#2c3e50", fontWeight: "bold" }}>📊 Orders Analytics Dashboard</h1>

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
                    <option value="last7">Last 7 Days</option>
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
            <div className="card-body">
              <h5 className="card-title">Total Orders</h5>
              <h2 className="card-text">{summary.totalOrders}</h2>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card text-white bg-info shadow">
            <div className="card-body">
              <h5 className="card-title">Total Revenue</h5>
              <h2 className="card-text">${summary.totalRevenue}</h2>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card text-white bg-warning shadow">
            <div className="card-body">
              <h5 className="card-title">Orders to Be Fulfilled</h5>
              <h2 className="card-text">{summary.ordersToFulfill}</h2>
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
                    <td className="text-success fw-semibold">${store.revenue.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}