import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { RecordForm } from '@/components/RecordForm';
import { useRecords } from '@/components/RecordsContext';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { createRecord, getImage, getRecord, updateRecord } from '@/db/repository';
import type { DataRecord, ImageAttachment, RecordInput } from '@/types';
import type { ProcessedImage } from '@/lib/image';

export default function RecordEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { reload } = useRecords();
  const { notify } = useToast();

  const [record, setRecord] = useState<DataRecord | null>(null);
  const [image, setImage] = useState<ImageAttachment | null>(null);
  const [loading, setLoading] = useState(Boolean(id));

  const isEdit = Boolean(id);

  useEffect(() => {
    let cancelled = false;
    if (!id) {
      setRecord(null);
      setImage(null);
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }
    const load = async () => {
      setLoading(true);
      const found = await getRecord(id);
      const attachment = found ? await getImage(found.id) : undefined;
      if (cancelled) return;
      setRecord(found ?? null);
      setImage(attachment ?? null);
      setLoading(false);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleSubmit = async (input: RecordInput, newImage: ProcessedImage | null, removeImage: boolean) => {
    if (id) {
      await updateRecord(id, input, { image: newImage, removeImage });
      notify(`Employee ${input.recordId} was updated.`, 'success');
    } else {
      await createRecord(input, newImage);
      notify(`Employee ${input.recordId} was created.`, 'success');
    }
    await reload();
    navigate('/records');
  };

  if (isEdit && loading) {
    return <Spinner label="Loading employee…" />;
  }

  if (isEdit && !record) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900">Employee not found</h1>
        <p className="text-sm text-ink-600">This employee does not exist (any more) in the local database.</p>
        <Button variant="outline" onClick={() => navigate('/records')}>
          Back to employees
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900">
          {isEdit ? 'Edit employee' : 'Add employee'}
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          {isEdit
            ? 'Changes are stored in this browser and are reflected in reports immediately.'
            : 'The new employee is stored in this browser only — export a backup to keep a copy.'}
        </p>
      </header>

      <RecordForm
        key={record?.id ?? 'new'}
        mode={isEdit ? 'edit' : 'create'}
        initial={record}
        existingImage={image}
        onSubmit={handleSubmit}
        onCancel={() => navigate('/records')}
      />
    </div>
  );
}
