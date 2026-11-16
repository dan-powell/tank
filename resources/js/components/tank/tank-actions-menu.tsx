import { Form, router } from '@inertiajs/react';
import { Ellipsis, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import InputError from '@/components/input-error';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { destroy, update } from '@/routes/tanks';

type Props = {
    tank: { id: number; name: string };
    className?: string;
};

/** A tank's management menu: rename it, or delete it for good. */
export function TankActionsMenu({ tank, className }: Props) {
    const [dialog, setDialog] = useState<'rename' | 'delete' | null>(null);
    const close = () => setDialog(null);

    return (
        <>
            <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="secondary"
                        size="icon"
                        className={className}
                        aria-label={`Manage ${tank.name}`}
                    >
                        <Ellipsis />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => setDialog('rename')}>
                        <Pencil /> Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => setDialog('delete')}
                    >
                        <Trash2 /> Delete
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <Dialog
                open={dialog === 'rename'}
                onOpenChange={(open) => !open && close()}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Rename tank</DialogTitle>
                        <DialogDescription>
                            Give {tank.name} a new name.
                        </DialogDescription>
                    </DialogHeader>
                    <Form
                        {...update.form(tank.id)}
                        options={{ preserveScroll: true }}
                        onSuccess={close}
                        className="space-y-5"
                    >
                        {({ processing, errors }) => (
                            <>
                                <div className="grid gap-2">
                                    <Label htmlFor={`tank-${tank.id}-name`}>
                                        Name
                                    </Label>
                                    <Input
                                        id={`tank-${tank.id}-name`}
                                        name="name"
                                        defaultValue={tank.name}
                                        maxLength={40}
                                        required
                                        autoFocus
                                    />
                                    <InputError message={errors.name} />
                                </div>
                                <DialogFooter>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={close}
                                    >
                                        Cancel
                                    </Button>
                                    <Button type="submit" disabled={processing}>
                                        Save
                                    </Button>
                                </DialogFooter>
                            </>
                        )}
                    </Form>
                </DialogContent>
            </Dialog>

            <AlertDialog
                open={dialog === 'delete'}
                onOpenChange={(open) => !open && close()}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete {tank.name}?</AlertDialogTitle>
                        <AlertDialogDescription>
                            The tank, every plant and animal in it, and its
                            history will be gone for good. This cannot be
                            undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            variant="destructive"
                            onClick={() =>
                                router.delete(destroy.url(tank.id), {
                                    preserveScroll: true,
                                })
                            }
                        >
                            <Trash2 /> Delete tank
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
