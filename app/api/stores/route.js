export async function GET() {
  const stores = [
    {
      id: 1,
      name: process.env.SHOPIFY_STORE_1_NAME,
      domain: process.env.SHOPIFY_STORE_1_DOMAIN,
      token: process.env.SHOPIFY_STORE_1_TOKEN
    },
    {
      id: 2,
      name: process.env.SHOPIFY_STORE_2_NAME,
      domain: process.env.SHOPIFY_STORE_2_DOMAIN,
      token: process.env.SHOPIFY_STORE_2_TOKEN
    },
    {
      id: 3,
      name: process.env.SHOPIFY_STORE_3_NAME,
      domain: process.env.SHOPIFY_STORE_3_DOMAIN,
      token: process.env.SHOPIFY_STORE_3_TOKEN
    },
    {
      id: 4,
      name: process.env.SHOPIFY_STORE_4_NAME,
      domain: process.env.SHOPIFY_STORE_4_DOMAIN,
      token: process.env.SHOPIFY_STORE_4_TOKEN
    },
    {
      id: 5,
      name: process.env.SHOPIFY_STORE_5_NAME,
      domain: process.env.SHOPIFY_STORE_5_DOMAIN,
      token: process.env.SHOPIFY_STORE_5_TOKEN
    },
    {
      id: 6,
      name: process.env.SHOPIFY_STORE_6_NAME,
      domain: process.env.SHOPIFY_STORE_6_DOMAIN,
      token: process.env.SHOPIFY_STORE_6_TOKEN
    },
    {
      id: 7,
      name: process.env.SHOPIFY_STORE_7_NAME,
      domain: process.env.SHOPIFY_STORE_7_DOMAIN,
      token: process.env.SHOPIFY_STORE_7_TOKEN
    },
    {
      id: 8,
      name: process.env.SHOPIFY_STORE_8_NAME,
      domain: process.env.SHOPIFY_STORE_8_DOMAIN,
      token: process.env.SHOPIFY_STORE_8_TOKEN
    }
  ];
  return Response.json(stores);
}