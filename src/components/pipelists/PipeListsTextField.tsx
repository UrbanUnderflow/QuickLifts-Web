import React from 'react';
import { mapPipeListTextOffset, mergePipeListText } from '../../utils/pipelistsText';

type Props = {
  value: string;
  onValueChange: (value: string) => void;
  multiline?: boolean;
  id?: string;
  'aria-label'?: string;
  type?: string;
  placeholder?: string;
  className?: string;
  onBlur?: () => void;
  required?: boolean;
  maxLength?: number;
};

type Selection = { start: number; end: number; direction: 'forward' | 'backward' | 'none' };

// Read the selection before React writes the remote value into the DOM.
// A normal local keystroke already has the right DOM value and needs no repair.
export default class PipeListsTextField extends React.Component<Props, { composition: string | null }> {
  state = { composition: null as string | null };
  private element: HTMLInputElement | HTMLTextAreaElement | null = null;
  private compositionBase: string | null = null;

  getSnapshotBeforeUpdate(): Selection | null {
    const field = this.element;
    const next = this.state.composition ?? this.props.value;
    if (!field || document.activeElement !== field || field.value === next || field.selectionStart === null || field.selectionEnd === null) return null;
    return {
      start: mapPipeListTextOffset(field.value, next, field.selectionStart),
      end: mapPipeListTextOffset(field.value, next, field.selectionEnd),
      direction: field.selectionDirection || 'none',
    };
  }

  componentDidUpdate(_previousProps: Props, _previousState: { composition: string | null }, selection: Selection | null) {
    if (selection) this.element?.setSelectionRange(selection.start, selection.end, selection.direction);
  }

  render() {
    const { value, onValueChange, multiline, ...attributes } = this.props;
    const events = {
      ref: (field: HTMLInputElement | HTMLTextAreaElement | null) => { this.element = field; },
      value: this.state.composition ?? value,
      onCompositionStart: () => {
        this.compositionBase = value;
        this.setState({ composition: value });
      },
      onCompositionEnd: (event: React.CompositionEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const typed = event.currentTarget.value;
        const result = mergePipeListText(this.compositionBase ?? value, value, typed);
        this.compositionBase = null;
        // Browsers can deliver a final input event after compositionend.
        // Keep its DOM value consistent with the integrated result.
        const field = event.currentTarget;
        if (result !== typed) {
          const { selectionStart, selectionEnd, selectionDirection } = field;
          field.value = result;
          if (selectionStart !== null && selectionEnd !== null) {
            field.setSelectionRange(mapPipeListTextOffset(typed, result, selectionStart),
              mapPipeListTextOffset(typed, result, selectionEnd), selectionDirection || 'none');
          }
        }
        this.setState({ composition: null });
        onValueChange(result);
      },
      onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (this.compositionBase !== null) this.setState({ composition: event.target.value });
        else onValueChange(event.target.value);
      },
    };
    return multiline ? <textarea {...attributes} {...events} /> : <input {...attributes} {...events} />;
  }
}
