def insert_into_tree(tree: dict, path_parts: list, file_data: dict):
    """
    Inserts file metadata into a nested dictionary structure.
    """
    current = tree
    for part in path_parts[:-1]:
        current = current.setdefault(part, {})

    current[path_parts[-1]] = file_data
