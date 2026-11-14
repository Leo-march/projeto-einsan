import PainelAnalise from "@/components/PainelAnalise";
import { obterAnalise } from "@/lib/servico-analise";

export const dynamic = "force-dynamic";

export default async function Home() {
  const analise = await obterAnalise();
  return <PainelAnalise analise={analise} />;
}