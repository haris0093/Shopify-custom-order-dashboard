import 'bootstrap/dist/css/bootstrap.min.css';

export const metadata = {
  title: 'Orders Analytics Dashboard',
  description: 'Analytics dashboard for orders across stores',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}