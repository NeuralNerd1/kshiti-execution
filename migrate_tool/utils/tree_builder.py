from typing import Dict, Any

FILE_META_KEYS = {"path", "content", "skipped"}

def is_file_node(node: Dict[str, Any]) -> bool:
    return isinstance(node, dict) and FILE_META_KEYS.issubset(node.keys())


def render_tree(tree: Dict[str, Any], parent_path="") -> str:
    html = "<ul>"

    for name, node in tree.items():
        current_path = f"{parent_path}/{name}" if parent_path else name

        # 📄 FILE
        if is_file_node(node):
            html += f"""
            <li class="file">
              <label>
                <input type="checkbox"
                       class="file-checkbox"
                       data-path="{current_path}">
                📄 {name}
              </label>
            </li>
            """
            continue

        # 📁 FOLDER
        html += f"""
        <li class="folder">
          <label>
            <input type="checkbox"
                   class="folder-checkbox"
                   data-path="{current_path}">
            📁 {name}
          </label>
        """

        html += render_tree(node, current_path)
        html += "</li>"

    html += "</ul>"
    return html
