import { FC, useEffect, useMemo } from 'react';
import { useWatch } from 'react-hook-form';
import { UploadFormData } from '../../types';
import { useUserId } from '../../contexts/firebase/hooks';
import { debounce } from 'lodash';

export const FormDataSaver: FC = () => {
  const formData = useWatch<UploadFormData>();
  const userId = useUserId();
  const debouncedFormData = useMemo(
    () =>
      debounce((formData: unknown) => localStorage.setItem('form_data' + userId, JSON.stringify(formData)), 100, {
        trailing: true
      }),
    [userId]
  );
  useEffect(() => {
    debouncedFormData(formData);
  }, [debouncedFormData, formData]);

  return null;
};
