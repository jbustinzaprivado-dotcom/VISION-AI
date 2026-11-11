import { Component } from 'react';

// Si una pantalla falla, muestra un mensaje claro en lugar de una página en blanco
// y permite reintentar (Proyecto, sección 12).
export default class ManejoErrores extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Error en la pantalla:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <section className="panel aviso" role="alert">
        <h1>Algo salió mal en esta pantalla</h1>
        <p>{this.state.error.message || 'Error desconocido.'}</p>
        <p className="nota">Los datos guardados no se pierden. Puedes reintentar o volver al inicio.</p>
        <div className="botones">
          <button type="button" onClick={() => this.setState({ error: null })}>
            Reintentar
          </button>
          <button type="button" className="secundario" onClick={() => window.location.assign('/')}>
            Volver al inicio
          </button>
        </div>
      </section>
    );
  }
}
