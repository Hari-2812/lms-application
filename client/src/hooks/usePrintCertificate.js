import { useCallback, useRef, useState } from 'react';

/**
 * "Download" for a certificate: opens the browser's print dialogue with only
 * the certificate on the page, where "Save as PDF" is the default
 * destination on every current platform.
 *
 * This is deliberately not a client-side PDF library. jsPDF/html2canvas would
 * add ~400KB to the bundle and rasterise the certificate into a fuzzy image;
 * printing keeps the text selectable and the output sharp at any size, and
 * the browser's own dialogue is a flow people already recognise.
 *
 * The heavy lifting is in the `@media print` block in index.css — this hook
 * only marks which certificate is being printed and cleans up afterwards.
 */
export default function usePrintCertificate() {
  const [printingId, setPrintingId] = useState(null);
  // Held across the async gap so cleanup always finds the right node, even
  // if the list re-renders while the dialogue is open.
  const activeNode = useRef(null);

  const print = useCallback((id, node) => {
    if (!node) return;

    setPrintingId(id);
    activeNode.current = node;
    node.setAttribute('data-print-root', 'true');
    document.body.classList.add('printing-certificate');

    const cleanup = () => {
      document.body.classList.remove('printing-certificate');
      activeNode.current?.removeAttribute('data-print-root');
      activeNode.current = null;
      setPrintingId(null);
      window.removeEventListener('afterprint', cleanup);
    };

    window.addEventListener('afterprint', cleanup);

    // A frame's grace so the class lands and styles settle before the
    // (synchronous, blocking) print dialogue opens.
    requestAnimationFrame(() => {
      window.print();
      // Safari never fires afterprint, so this is the backstop. Harmless
      // when afterprint did fire — cleanup removes its own listener and the
      // attribute removal is idempotent.
      setTimeout(cleanup, 1000);
    });
  }, []);

  return { print, printingId };
}
