import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { SuggestionOverlay } from '../src/content/SuggestionOverlay';

describe('SuggestionOverlay', () => {
  it('renders icons and suggestions list', () => {
    const html = renderToString(
      SuggestionOverlay({
        text: 'First completion',
        x: 10,
        y: 20,
        onAccept: () => {},
        onDismiss: () => {},
        visible: true,
        notice: 'On-device',
        loading: false,
        suggestions: ['First completion', 'Second option', 'Third variant'],
        selectedIndex: 1,
        onSelect: () => {},
      })
    );
    expect(html).toContain('svg'); // icons present
    expect(html).toContain('First completion');
    expect(html).toContain('Second option');
    expect(html).toContain('Third variant');
  });
});
