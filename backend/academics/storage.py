from storages.backends.s3boto3 import S3Boto3Storage


class AssignmentFileStorage(S3Boto3Storage):
    """
    Custom storage for assignment and submission files.
    Uses DigitalOcean Spaces (S3-compatible) with public-read access.
    """
    default_acl = 'public-read'
    file_overwrite = False
