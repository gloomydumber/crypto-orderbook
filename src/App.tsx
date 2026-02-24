import { Orderbook } from './components/Orderbook'

function App() {
  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#0a0a0a' }}>
      <div style={{ width: 480, height: 900 }}>
        <Orderbook height="100%" />
      </div>
    </div>
  )
}

export default App
