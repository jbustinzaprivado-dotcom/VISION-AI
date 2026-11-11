// Pantalla provisional: explica qué hará la pantalla y en qué fase se construye.
export default function PantallaPendiente({ titulo, descripcion, fase }) {
  return (
    <section className="panel">
      <h1>{titulo}</h1>
      <p>{descripcion}</p>
      <p className="nota">Se construye en la fase {fase}.</p>
    </section>
  );
}
