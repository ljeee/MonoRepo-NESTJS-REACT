import os
import re

frontend_dir = r'f:\Codigo\MonoRepo\Frontend'
app_dir = os.path.join(frontend_dir, 'app')

def fix_imports(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    rel_path = os.path.relpath(file_path, app_dir)
    depth = len(rel_path.split(os.sep)) - 1
    
    # Path to reach root from depths
    # depth 0 (app/login.tsx) -> ../
    # depth 1 (app/(web)/index.tsx) -> ../../
    root_prefix = '../' * (depth + 1)
    wrong_prefix = '../' * depth if depth > 0 else None
    
    modified = False
    new_lines = []
    
    # Target folders that should be relative to root
    targets = ['tw', 'components', 'services', 'contexts', 'styles', 'constants', 'utils']
    
    for line in lines:
        new_line = line
        # If depth is 1, we want ../../target, but if we find ../target, it's WRONG.
        if depth > 0:
            for target in targets:
                # Replace '../target' with '../../target' if depth is 1
                pattern = f"from '../{target}"
                if pattern in line:
                    new_line = line.replace(f"from '../{target}", f"from '{root_prefix}{target}")
                    modified = True
                    print(f"Fixed {target} in {rel_path}: {line.strip()} -> {new_line.strip()}")
        
        # Also catch any imports that might be absolute or wrong-depth
        # But focus on the reported '../tw' issue.
        new_lines.append(new_line)
        
    if modified:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.writelines(new_lines)
        return True
    return False

count = 0
for root, dirs, files in os.walk(app_dir):
    for file in files:
        if file.endswith('.tsx'):
            if fix_imports(os.path.join(root, file)):
                count += 1

print(f"Finished. Modified {count} files.")
