# Huong dan cai dat va chay DOMIX tren Windows

File nay dung cho may moi chua cai Python/Node.js. Lam theo tung buoc tu tren xuong duoi.

## Buoc 1: Kiem tra Python

Mo Command Prompt hoac PowerShell, chay:

```bat
python --version
```

Neu hien ra phien ban Python, vi du `Python 3.x.x`, la da co Python.

Neu bao loi khong tim thay `python`:

1. Tai Python tai trang chinh thuc: https://www.python.org/downloads/windows/
2. Chay file cai dat.
3. Bat buoc tick `Add python.exe to PATH` truoc khi bam Install.
4. Cai xong thi dong Command Prompt/PowerShell cu, mo lai cua so moi.
5. Kiem tra lai:

```bat
python --version
python -m pip --version
```

## Buoc 2: Kiem tra Node.js va npm

Mo Command Prompt hoac PowerShell, chay:

```bat
node -v
npm -v
```

Neu ca hai lenh deu hien version thi da co Node.js.

Neu chua co:

1. Tai Node.js tai trang chinh thuc: https://nodejs.org/en/download
2. Chon ban `LTS` cho Windows.
3. Cai dat theo mac dinh.
4. Cai xong thi dong Command Prompt/PowerShell cu, mo lai cua so moi.
5. Kiem tra lai:

```bat
node -v
npm -v
```

## Buoc 3: Di den thu muc project

Project hien tai nam o:

```bat
D:\Project\Domix
```

Neu chay bang Command Prompt/PowerShell, dung lenh:

```bat
cd /d D:\Project\Domix
```

Neu double-click truc tiep file `run.bat` trong thu muc project thi khong can go lenh `cd`. File `run.bat` da tu chuyen ve dung thu muc chua no truoc khi chay.

## Buoc 4: Chay ung dung

Trong thu muc `D:\Project\Domix`, chay:

```bat
run.bat
```

File `run.bat` se tu dong:

1. Chuyen vao dung thu muc chua `run.bat`.
2. Kiem tra Python.
3. Kiem tra Node.js/npm.
4. Cai Python dependencies bang:

```bat
python -m pip install -r requirements.txt
```

5. Cai frontend dependencies neu chua co `node_modules`:

```bat
npm install
```

6. Build frontend:

```bat
npm.cmd run build
```

7. Chay server backend va serve luon frontend:

```bat
python backend\server.py --host 0.0.0.0 --port 8000
```

## Buoc 5: Mo trinh duyet

Tren may dang chay server, mo:

```text
http://127.0.0.1:8000
```

May khac cung mang LAN thi mo:

```text
http://IP_MAY_CHU:8000
```

Vi du may chu co IP `192.168.1.10` thi may khac mo:

```text
http://192.168.1.10:8000
```

## Tai khoan mac dinh khi DB moi

Neu database moi chua co user, he thong se tao admin mac dinh:

```text
Email: admin@gmail.com
Mat khau: admin123@
```

## Cach dung server

- De dung server: quay lai cua so dang chay `run.bat`, bam `Ctrl + C`, roi bam `Y` neu Windows hoi xac nhan.
- De chay lai: chay lai `run.bat`.
- File database nam o:

```text
data\domix.sqlite3
```

## Loi thuong gap

### 1. Loi khong tim thay python

Nguyen nhan: Python chua cai hoac chua them vao PATH.

Cach sua:

- Cai Python tu https://www.python.org/downloads/windows/
- Khi cai nho tick `Add python.exe to PATH`
- Mo lai Command Prompt/PowerShell moi.

### 2. Loi khong tim thay npm.cmd

Nguyen nhan: Node.js chua cai hoac chua them vao PATH.

Cach sua:

- Cai Node.js LTS tu https://nodejs.org/en/download
- Mo lai Command Prompt/PowerShell moi.

### 3. Trang web khong vao duoc tu may khac

Kiem tra:

- May chu va may khac phai cung mang LAN.
- Dung dung IP cua may chu.
- Windows Firewall co the dang chan cong `8000`.

### 4. Man hinh trang / loi sau khi sua code

Chay lai:

```bat
run.bat
```

Neu server dang chay, dung bang `Ctrl + C` roi chay lai.
