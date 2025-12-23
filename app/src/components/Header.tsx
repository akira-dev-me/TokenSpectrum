import { ConnectButton } from '@rainbow-me/rainbowkit';
import '../styles/Header.css';

export function Header() {
  return (
    <header className="header">
      <div className="header-container">
        <div className="header-content">
          <div className="header-left">
            <h1 className="header-title">TokenSpectrum</h1>
            <div className="header-subtitle">Confidential NFTs + confidential rewards</div>
          </div>
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}
