from cloudinary_storage.storage import RawMediaCloudinaryStorage

class AssignmentFileStorage(RawMediaCloudinaryStorage):
    """
    Custom storage for assignment files that supports all file types including
    ZIP, PDF, DOCX, etc.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Ensure files are publicly accessible
        self.CLOUDINARY_RESOURCE_OPTIONS = {
            'resource_type': 'raw',
            'type': 'upload',
            'access_mode': 'public'
        }
