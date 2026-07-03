export const getStatusBadgeColor = (
  status: 'NEW' | 'QUEUED' | 'PROCESSING' | 'PROCESSED' | 'REPROCESSING' | 'TAGGING' | 'FAILED' | 'DELETED'
) => {
  switch (status) {
    case 'NEW':
      return 'green';
    case 'QUEUED':
      return 'blue';
    case 'PROCESSING':
    case 'TAGGING':
      return 'blue';
    case 'PROCESSED':
      return 'green';
    case 'REPROCESSING':
      return 'orange';
    case 'FAILED':
      return 'red';
    case 'DELETED':
      return 'gray';
    default:
      return 'secondary';
  }
};
