import { useState } from 'react';
import { useAtlasSdk } from '@atlas/sdk/react';

export function HostWidgets() {
  const atlas = useAtlasSdk();
  const [showReact, setShowReact] = useState(false);
  const [showAngular, setShowAngular] = useState(false);
  const [count, setCount] = useState(12);
  const [status, setStatus] = useState('pending');
  const ProductCount = atlas.getWidget<{ count: number }>(
    '6f4994c1-b95f-4b24-a01a-106dd61aa4fb',
  );
  const OrderStatus = atlas.getWidget<{ status: string }>(
    '98abc74d-a11f-4eca-8255-c6f2f49e3d6e',
  );

  return (
    <section aria-label="Host widgets">
      <h2>Host widgets</h2>
      <button onClick={() => setShowReact(!showReact)}>
        {showReact ? 'Hide React widget' : 'Show React widget'}
      </button>
      <button onClick={() => setCount(24)}>Update React widget</button>
      <button onClick={() => setShowAngular(!showAngular)}>
        {showAngular ? 'Hide Angular widget' : 'Show Angular widget'}
      </button>
      <button onClick={() => setStatus('paid')}>Update Angular widget</button>
      {showReact && (
        <section aria-label="React widget">
          <ProductCount count={count} />
        </section>
      )}
      {showAngular && (
        <section aria-label="Angular widget">
          <OrderStatus status={status} />
        </section>
      )}
    </section>
  );
}
