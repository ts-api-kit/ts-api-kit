import { handle } from "@ts-api-kit/core";

export default function Home() {
  return <div>Home</div>;
}

export const GET = handle(() => {
  return <div>Olá HTML!</div>;
});
