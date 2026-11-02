import { FocusEditor } from "../FocusEditor";

export default async function InFocusExperimentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FocusEditor id={id} />;
}
