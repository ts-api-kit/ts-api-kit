export default function Layout({ children }: { children: string }) {
  console.log("Layout", children);
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Exemplo com Layout</title>
      </head>
      <body>
        <header>
          <h1>Layout Padrão</h1>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}

