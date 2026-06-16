/**
 * Tiny promise-based confirm/alert that replaces window.confirm and
 * window.alert with a themed modal mounted once in the layout.
 *
 *   const { confirm, alert } = useConfirm();
 *   if (!(await confirm({ title, message, tone: 'danger' }))) return;
 *   try { … } catch (e) { await alert({ title, message: e?.data?.message }); }
 */
export type ConfirmTone = 'danger' | 'warning' | 'neutral' | 'info';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
}

export interface AlertOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  tone?: ConfirmTone;
}

interface DialogState extends ConfirmOptions {
  singleAction: boolean;
  resolve: (ok: boolean) => void;
}

export function useConfirm() {
  const dialog = useState<DialogState | null>('confirm_dialog', () => null);

  function confirm(opts: ConfirmOptions): Promise<boolean> {
    return new Promise((resolve) => {
      dialog.value = { ...opts, singleAction: false, resolve };
    });
  }

  function alert(opts: AlertOptions): Promise<void> {
    return new Promise((resolve) => {
      dialog.value = {
        ...opts,
        singleAction: true,
        confirmLabel: opts.confirmLabel ?? 'OK',
        resolve: () => resolve(),
      };
    });
  }

  function onConfirm(): void {
    const d = dialog.value;
    dialog.value = null;
    d?.resolve(true);
  }

  function onClose(): void {
    const d = dialog.value;
    dialog.value = null;
    d?.resolve(false);
  }

  return { dialog, confirm, alert, onConfirm, onClose };
}
