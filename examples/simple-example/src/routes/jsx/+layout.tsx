export default function Layout({ children }: { children: JSX.Element }) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Example with Layout</title>
      </head>
      <body>
        <header>
          <h1>Default Layout</h1>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}

