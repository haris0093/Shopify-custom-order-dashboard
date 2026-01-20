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
          fields: "id,name,email,financial_status,fulfillment_status,total_price,created_at,line_items,cancelled_at,refunds",
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

  // Fetch ALL products with pagination to build complete handleMap
  const handleMap = {};
  const imageMap = {};

  for (const store of stores) {
    const domain = process.env[`SHOPIFY_STORE_${store.id}_DOMAIN`];
    const token = process.env[`SHOPIFY_STORE_${store.id}_TOKEN`];
    if (!domain || !token) continue;

    let nextUrl = null;
    let hasNextPage = true;
    let pageCount = 0;

    console.log(`Store ${store.id}: Starting product fetch with pagination`);

    while (hasNextPage && pageCount < 100) { // Safety limit of 100 pages
      let url;
      if (!nextUrl) {
        // First request - get all products with basic fields
        url = `https://${domain}/admin/api/2024-01/products.json?limit=250&fields=id,handle,images,status`;
      } else {
        // Subsequent requests use the next URL directly
        url = nextUrl;
      }

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
        const response = await fetch(url, {
          headers: { "X-Shopify-Access-Token": token },
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        const data = await response.json();
        const products = data.products || [];
        pageCount++;

        console.log(`Store ${store.id}: Page ${pageCount} - fetched ${products.length} products`);

        // Only process published/active products
        products.forEach(product => {
          if (product.status === 'active') {
            handleMap[product.id] = product.handle;
            if (product.images && product.images.length > 0) {
              imageMap[product.id] = product.images[0].src;
            }
          }
        });

        // Check for next page using Link header
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
        console.error(`Error fetching products for store ${store.id} on page ${pageCount}:`, err);
        hasNextPage = false;
      }
    }

    console.log(`Store ${store.id}: Completed product fetch. Total products in maps: handles=${Object.keys(handleMap).length}, images=${Object.keys(imageMap).length}`);
  }

  // Update all line items with product data
  allData.forEach(order => {
    order.line_items.forEach(item => {
      if (item.product_id && imageMap[item.product_id]) {
        item.image = { src: imageMap[item.product_id] };
      }
      if (item.product_id && handleMap[item.product_id]) {
        item.product_url = `https://${storeDomains[order.store_id]}/products/${handleMap[item.product_id]}`;
      } else if (item.product_id) {
        // Fallback URL if handle not found but product_id exists
        item.product_url = `https://${storeDomains[order.store_id]}/admin/products/${item.product_id}`;
        console.log(`Order ${order.name}: Using fallback URL for product ${item.product_id}`);
      } else {
        console.log(`Order ${order.name}: Line item "${item.title}" has no product_id`);
      }
    });
  });

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
      revenue: 0,
      lostAmount: 0
    };
  });

  allData.forEach(order => {
    const stat = storeStats[order.store_id];
    const orderAmount = parseFloat(order.total_price || 0);
    stat.totalOrders++;
    if (order.fulfillment_status === 'fulfilled') stat.fulfilled++;
    if (order.financial_status === 'partially_refunded') {
      stat.partiallyRefunded++;
      stat.lostAmount += orderAmount; // Add partially refunded amount to lost amount
    }
    if (order.financial_status === 'refunded') stat.fullyRefunded++;
    if (order.cancelled_at) {
      stat.cancelled++;
      stat.lostAmount += orderAmount; // Add cancelled order amount to lost amount
    }
    stat.revenue += orderAmount;
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