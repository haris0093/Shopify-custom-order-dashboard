export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const start_date = searchParams.get('start_date');
  const end_date = searchParams.get('end_date');

  if (!start_date || !end_date) {
    return Response.json({ error: "start_date and end_date are required" }, { status: 400 });
  }

  // Fetch all stores
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
  const storesResponse = await fetch(`${request.headers.get('host')?.includes('localhost') ? 'http' : 'https'}://${request.headers.get('host')}/api/stores`, {
    signal: controller.signal
  });
  clearTimeout(timeoutId);
  const stores = await storesResponse.json();

  const allData = [];

  // Fetch primary domains for each store
  const storeDomains = {};
  for (const store of stores) {
    const domain = process.env[`SHOPIFY_STORE_${store.id}_DOMAIN`];
    const token = process.env[`SHOPIFY_STORE_${store.id}_TOKEN`];
    if (!domain || !token) continue;
    try {
      const response = await fetch(`https://${domain}/admin/api/2024-01/shop.json`, {
        headers: { "X-Shopify-Access-Token": token }
      });
      const shopData = await response.json();
      storeDomains[store.id] = shopData.shop.domain;
    } catch (err) {
      console.error(`Error fetching shop domain for store ${store.id}:`, err);
      storeDomains[store.id] = domain; // fallback to API domain
    }
  }

  // Fetch orders for each store, handling pagination
  for (const store of stores) {
    const domain = process.env[`SHOPIFY_STORE_${store.id}_DOMAIN`];
    const token = process.env[`SHOPIFY_STORE_${store.id}_TOKEN`];

    if (!domain || !token) continue;

    let nextUrl = null;
    let hasNextPage = true;

    while (hasNextPage) {
      let url;
      if (!nextUrl) {
        // First request with filters
        const params = new URLSearchParams({
          limit: 250,
          status: "any",
          order: "created_at asc",
          fields: "id,name,email,financial_status,fulfillment_status,total_price,created_at,line_items",
          created_at_min: start_date,
          created_at_max: end_date
        });
        url = `https://${domain}/admin/api/2024-01/orders.json?${params.toString()}`;
      } else {
        // Subsequent requests use the next URL directly
        url = nextUrl;
      }

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout per store
        const response = await fetch(url, {
          headers: { "X-Shopify-Access-Token": token },
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        const data = await response.json();
        const orders = data.orders || [];

        // Add store info to each order
        orders.forEach(order => {
          allData.push({
            ...order,
            store_id: store.id,
            store_name: store.name,
            store_domain: domain
          });
        });

        // Check for next page
        const link = response.headers.get("link");
        if (link) {
          const links = link.split(',').map(l => l.trim());
          const nextLink = links.find(l => l.includes('rel="next"'));
          if (nextLink) {
            const match = nextLink.match(/<([^>]+)>/);
            if (match) {
              nextUrl = match[1];
            } else {
              hasNextPage = false;
            }
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

  // Fetch product images
  const productIdsByStore = {};
  allData.forEach(order => {
    if (!productIdsByStore[order.store_id]) productIdsByStore[order.store_id] = new Set();
    order.line_items.forEach(item => {
      if (item.product_id) productIdsByStore[order.store_id].add(item.product_id);
    });
  });

  for (const store of stores) {
    const productIds = productIdsByStore[store.id];
    if (!productIds || productIds.size === 0) continue;
    const domain = process.env[`SHOPIFY_STORE_${store.id}_DOMAIN`];
    const token = process.env[`SHOPIFY_STORE_${store.id}_TOKEN`];
    if (!domain || !token) continue;
    const ids = Array.from(productIds).join(',');
    try {
      const response = await fetch(`https://${domain}/admin/api/2024-01/products.json?ids=${ids}&fields=id,handle,images`, {
        headers: { "X-Shopify-Access-Token": token }
      });
      const data = await response.json();
      const products = data.products || [];
      const imageMap = {};
      const handleMap = {};
      products.forEach(product => {
        if (product.images && product.images.length > 0) {
          imageMap[product.id] = product.images[0].src;
        }
        handleMap[product.id] = product.handle;
      });
      // Update allData for this store
      allData.forEach(order => {
        if (order.store_id === store.id) {
          order.line_items.forEach(item => {
            if (item.product_id && imageMap[item.product_id]) {
              item.image = { src: imageMap[item.product_id] };
            }
            if (item.product_id && handleMap[item.product_id]) {
              item.product_url = `https://${storeDomains[order.store_id]}/products/${handleMap[item.product_id]}`;
            }
          });
        }
      });
    } catch (err) {
      console.error(`Error fetching products for store ${store.id}:`, err);
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
    storeTable,
    orders: allData
  });
}