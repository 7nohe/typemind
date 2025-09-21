import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { SuggestionOverlay } from '../src/content/SuggestionOverlay';

describe('SuggestionOverlay', () => {
  it('renders overlay chrome with navigation controls', () => {
    const html = renderToString(
      SuggestionOverlay({
        text: 'Second option',
        x: 10,
        y: 20,
        onAccept: () => {},
        onDismiss: () => {},
        visible: true,
        notice: 'On-device',
        loading: false,
        pending: true,
        suggestions: ['First completion', 'Second option', 'Third variant'],
        selectedIndex: 1,
        onSelect: () => {},
        acceptLabel: 'Tab',
      })
    );
    expect(html).toContain('svg'); // icons present
    expect(html).toContain('Second option');
    expect(html).toContain('Suggestion <!-- -->2<!-- --> / <!-- -->3');
    expect(html).toContain('Prev (Opt+[');
    expect(html).toContain('Next (Opt+])');
    expect(html).toContain('On-device');
  });
});
