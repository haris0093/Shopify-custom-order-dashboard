export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const start_date = searchParams.get('start_date');
  const end_date = searchParams.get('end_date');

  if (!start_date || !end_date) {
    return Response.json({ error: "start_date and end_date are required" }, { status: 400 });
  }

  // Fetch all stores
  const storesResponse = await fetch(`${request.headers.get('host')?.includes('localhost') ? 'http' : 'https'}://${request.headers.get('host')}/api/stores`);
  const stores = await storesResponse.json();

  const allData = [];

  // Fetch orders for each store, handling pagination
  for (const store of stores) {
    const domain = process.env[`SHOPIFY_STORE_${store.id}_DOMAIN`];
    const token = process.env[`SHOPIFY_STORE_${store.id}_TOKEN`];

    if (!domain || !token) continue;

    let pageInfo = null;
    let hasNextPage = true;

    while (hasNextPage) {
      const params = new URLSearchParams({
        limit: 250,
        status: "any",
        order: "created_at asc",
        fields: "id,name,email,financial_status,fulfillment_status,total_price,created_at",
        created_at_min: start_date,
        created_at_max: end_date
      });

      if (pageInfo) params.append("page_info", pageInfo);

      const url = `https://${domain}/admin/api/2024-01/orders.json?${params.toString()}`;

      try {
        const response = await fetch(url, {
          headers: { "X-Shopify-Access-Token": token }
        });
        const data = await response.json();
        const orders = data.orders || [];

        // Add store info to each order
        orders.forEach(order => {
          allData.push({
            ...order,
            store_id: store.id,
            store_name: store.name
          });
        });

        // Check for next page
        const link = response.headers.get("link");
        if (link && link.includes('rel="next"')) {
          const matches = [...link.matchAll(/<[^>]+page_info=([^&>]+)[^>]*>;\s*rel="next"/g)];
          if (matches.length > 0) {
            pageInfo = matches[0][1];
          } else {
            hasNextPage = false;
          }
        } else {
          hasNextPage = false;
        }
      } catch (err) {
        console.error(`Error fetching for store ${store.id}:`, err);
        hasNextPage = false;
      }
    }
  }

  // Now compute aggregates
  const totalOrders = allData.length;
  const totalRevenue = allData.reduce((sum, o) => sum + parseFloat(o.total_price || 0), 0);
  const ordersToFulfill = allData.filter(o => o.fulfillment_status !== 'fulfilled').length;

  // Group by store
  const storeStats = {};
  stores.forEach(store => {
    storeStats[store.id] = {
      brand: store.name,
      totalOrders: 0,
      fulfilled: 0,
      partiallyRefunded: 0,
      fullyRefunded: 0,
      cancelled: 0,
      revenue: 0
    };
  });

  allData.forEach(order => {
    const stat = storeStats[order.store_id];
    stat.totalOrders++;
    if (order.fulfillment_status === 'fulfilled') stat.fulfilled++;
    if (order.financial_status === 'partially_refunded') stat.partiallyRefunded++;
    if (order.financial_status === 'refunded') stat.fullyRefunded++;
    if (order.fulfillment_status === 'cancelled' || order.financial_status === 'voided') stat.cancelled++;
    stat.revenue += parseFloat(order.total_price || 0);
  });

  const storeTable = Object.values(storeStats);

  return Response.json({
    summary: {
      totalOrders,
      totalRevenue: totalRevenue.toFixed(2),
      ordersToFulfill
    },
    storeTable
  });
}