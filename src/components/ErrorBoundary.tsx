import React from "react";

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
};

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="container py-24 text-center px-6">
          <h2 className="text-2xl font-bold mb-2">Qualcosa è andato storto</h2>
          <p className="text-muted-foreground">Ricarica la pagina o riprova più tardi.</p>
        </div>
      );
    }
    return this.props.children;
  }
}
