import os
import uuid
from datetime import datetime
from functools import wraps

from flask import (
    Flask,
    jsonify,
    request,
    session,
    send_from_directory,
    render_template
)

from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from dotenv import load_dotenv


# =========================================================
# CONFIGURATION
# =========================================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

load_dotenv(os.path.join(BASE_DIR, ".env"))

UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")

os.makedirs(UPLOAD_FOLDER, exist_ok=True)


app = Flask(
    __name__,
    template_folder="templates",
    static_folder="static"
)


app.config["SECRET_KEY"] = os.getenv(
    "SECRET_KEY",
    "development-secret-key"
)


DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "3306")
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_NAME = os.getenv("DB_NAME", "milkymemory")


# =========================================================
# DATABASE
# =========================================================

password_part = DB_PASSWORD.replace("@", "%40").replace(":", "%3A")
user_part = DB_USER.replace("@", "%40").replace(":", "%3A")


if DB_PASSWORD:
    DATABASE_URL = (
        f"mysql+pymysql://"
        f"{user_part}:{password_part}@"
        f"{DB_HOST}:{DB_PORT}/{DB_NAME}"
    )
else:
    DATABASE_URL = (
        f"mysql+pymysql://"
        f"{user_part}@"
        f"{DB_HOST}:{DB_PORT}/{DB_NAME}"
    )


app.config["SQLALCHEMY_DATABASE_URI"] = DATABASE_URL
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024


db = SQLAlchemy(app)


# =========================================================
# MODELS
# =========================================================

class User(db.Model):

    __tablename__ = "users"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    username = db.Column(
        db.String(80),
        unique=True,
        nullable=False
    )

    password_hash = db.Column(
        db.String(255),
        nullable=False
    )

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow
    )

    memories = db.relationship(
        "Memory",
        backref="user",
        lazy=True,
        cascade="all, delete-orphan"
    )


class Memory(db.Model):

    __tablename__ = "memories"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False
    )

    title = db.Column(
        db.String(200),
        nullable=False
    )

    date = db.Column(
        db.Date,
        nullable=False
    )

    description = db.Column(
        db.Text,
        default=""
    )

    tags = db.Column(
        db.Text,
        default=""
    )

    image = db.Column(
        db.String(500),
        default=""
    )

    color = db.Column(
        db.String(20),
        default="#b57cff"
    )

    x = db.Column(
        db.Float,
        default=50
    )

    y = db.Column(
        db.Float,
        default=50
    )

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow
    )


class Album(db.Model):

    __tablename__ = "albums"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False
    )

    name = db.Column(
        db.String(150),
        nullable=False
    )

    description = db.Column(
        db.Text,
        default=""
    )

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow
    )


# =========================================================
# HELPERS
# =========================================================

def login_required(function):

    @wraps(function)
    def wrapper(*args, **kwargs):

        if "user_id" not in session:

            return jsonify({
                "success": False,
                "message": "Please login first."
            }), 401

        return function(*args, **kwargs)

    return wrapper


def current_user():

    user_id = session.get("user_id")

    if not user_id:
        return None

    return db.session.get(
        User,
        user_id
    )


def tags_to_list(tags):

    if not tags:
        return []

    return [
        tag.strip().lower()
        for tag in tags.split(",")
        if tag.strip()
    ]


def list_to_tags(tags):

    if not tags:
        return ""

    return ",".join(
        str(tag).strip().lower()
        for tag in tags
        if str(tag).strip()
    )


def memory_to_dict(memory):

    return {
        "id": memory.id,
        "title": memory.title,
        "date": memory.date.isoformat(),
        "description": memory.description or "",
        "tags": tags_to_list(memory.tags),
        "image": memory.image or "",
        "color": memory.color or "#b57cff",
        "x": memory.x,
        "y": memory.y
    }


def save_uploaded_image(file):

    if not file or not file.filename:
        return ""

    allowed = {
        "png",
        "jpg",
        "jpeg",
        "gif",
        "webp"
    }

    filename = secure_filename(
        file.filename
    )

    extension = filename.rsplit(
        ".",
        1
    )[-1].lower() if "." in filename else ""

    if extension not in allowed:
        return ""

    new_name = (
        uuid.uuid4().hex
        + "."
        + extension
    )

    file.save(
        os.path.join(
            UPLOAD_FOLDER,
            new_name
        )
    )

    return "/uploads/" + new_name


# =========================================================
# FRONTEND
# =========================================================

@app.route("/")
def index():

    return render_template(
        "index.html"
    )


@app.route("/uploads/<path:filename>")
def uploaded_file(filename):

    return send_from_directory(
        UPLOAD_FOLDER,
        filename
    )


# =========================================================
# AUTH
# =========================================================

@app.route("/api/register", methods=["POST"])
def register():

    data = request.get_json(
        silent=True
    ) or {}

    username = str(
        data.get("username", "")
    ).strip()

    password = str(
        data.get("password", "")
    )


    if len(username) < 3:

        return jsonify({
            "success": False,
            "message":
                "Username must contain at least 3 characters."
        }), 400


    if len(password) < 4:

        return jsonify({
            "success": False,
            "message":
                "Password must contain at least 4 characters."
        }), 400


    existing = User.query.filter_by(
        username=username
    ).first()


    if existing:

        return jsonify({
            "success": False,
            "message":
                "Username already exists."
        }), 409


    user = User(
        username=username,
        password_hash=generate_password_hash(
            password
        )
    )


    db.session.add(user)
    db.session.commit()


    session["user_id"] = user.id


    return jsonify({
        "success": True,
        "user": {
            "id": user.id,
            "username": user.username
        }
    })


@app.route("/api/login", methods=["POST"])
def login():

    data = request.get_json(
        silent=True
    ) or {}

    username = str(
        data.get("username", "")
    ).strip()

    password = str(
        data.get("password", "")
    )


    user = User.query.filter_by(
        username=username
    ).first()


    if not user:

        return jsonify({
            "success": False,
            "message":
                "Account not found."
        }), 401


    if not check_password_hash(
        user.password_hash,
        password
    ):

        return jsonify({
            "success": False,
            "message":
                "Incorrect password."
        }), 401


    session["user_id"] = user.id


    return jsonify({
        "success": True,
        "user": {
            "id": user.id,
            "username": user.username
        }
    })


@app.route("/api/logout", methods=["POST"])
def logout():

    session.clear()

    return jsonify({
        "success": True
    })


@app.route("/api/me")
def me():

    user = current_user()


    if not user:

        return jsonify({
            "logged_in": False
        })


    return jsonify({
        "logged_in": True,
        "user": {
            "id": user.id,
            "username": user.username
        }
    })


# =========================================================
# MEMORIES
# =========================================================

@app.route("/api/memories", methods=["GET"])
@login_required
def get_memories():

    user = current_user()


    memories = Memory.query.filter_by(
        user_id=user.id
    ).order_by(
        Memory.date.desc()
    ).all()


    return jsonify([
        memory_to_dict(memory)
        for memory in memories
    ])


@app.route("/api/memories", methods=["POST"])
@login_required
def create_memory():

    user = current_user()


    title = request.form.get(
        "title",
        ""
    ).strip()

    date_string = request.form.get(
        "date",
        ""
    ).strip()

    description = request.form.get(
        "description",
        ""
    ).strip()

    tags = request.form.get(
        "tags",
        ""
    ).strip()

    color = request.form.get(
        "color",
        "#b57cff"
    )

    x = request.form.get(
        "x",
        50
    )

    y = request.form.get(
        "y",
        50
    )


    if not title:

        return jsonify({
            "success": False,
            "message": "Title is required."
        }), 400


    try:

        memory_date = datetime.strptime(
            date_string,
            "%Y-%m-%d"
        ).date()

    except ValueError:

        return jsonify({
            "success": False,
            "message": "Invalid date."
        }), 400


    image = save_uploaded_image(
        request.files.get("image")
    )


    memory = Memory(

        user_id=user.id,

        title=title,

        date=memory_date,

        description=description,

        tags=tags,

        image=image,

        color=color,

        x=float(x),

        y=float(y)
    )


    db.session.add(memory)
    db.session.commit()


    return jsonify({
        "success": True,
        "memory": memory_to_dict(memory)
    })


@app.route(
    "/api/memories/<int:memory_id>",
    methods=["PUT"]
)
@login_required
def update_memory(memory_id):

    user = current_user()


    memory = Memory.query.filter_by(
        id=memory_id,
        user_id=user.id
    ).first()


    if not memory:

        return jsonify({
            "success": False,
            "message": "Memory not found."
        }), 404


    data = request.form


    if "title" in data:

        memory.title = data.get(
            "title",
            memory.title
        ).strip()


    if "date" in data:

        try:

            memory.date = datetime.strptime(
                data.get("date"),
                "%Y-%m-%d"
            ).date()

        except ValueError:

            return jsonify({
                "success": False,
                "message": "Invalid date."
            }), 400


    if "description" in data:

        memory.description = data.get(
            "description",
            ""
        ).strip()


    if "tags" in data:

        memory.tags = data.get(
            "tags",
            ""
        ).strip()


    if "color" in data:

        memory.color = data.get(
            "color",
            memory.color
        )


    if "x" in data:

        memory.x = float(
            data.get("x")
        )


    if "y" in data:

        memory.y = float(
            data.get("y")
        )


    image_file = request.files.get(
        "image"
    )


    if image_file:

        new_image = save_uploaded_image(
            image_file
        )

        if new_image:

            memory.image = new_image


    db.session.commit()


    return jsonify({
        "success": True,
        "memory": memory_to_dict(memory)
    })


@app.route(
    "/api/memories/<int:memory_id>",
    methods=["DELETE"]
)
@login_required
def delete_memory(memory_id):

    user = current_user()


    memory = Memory.query.filter_by(
        id=memory_id,
        user_id=user.id
    ).first()


    if not memory:

        return jsonify({
            "success": False,
            "message": "Memory not found."
        }), 404


    db.session.delete(memory)
    db.session.commit()


    return jsonify({
        "success": True
    })


# =========================================================
# ALBUMS
# =========================================================

@app.route("/api/albums", methods=["GET"])
@login_required
def get_albums():

    user = current_user()


    albums = Album.query.filter_by(
        user_id=user.id
    ).order_by(
        Album.created_at.desc()
    ).all()


    return jsonify([
        {
            "id": album.id,
            "name": album.name,
            "description": album.description
        }
        for album in albums
    ])


@app.route("/api/albums", methods=["POST"])
@login_required
def create_album():

    user = current_user()


    data = request.get_json(
        silent=True
    ) or {}


    name = str(
        data.get("name", "")
    ).strip()

    description = str(
        data.get("description", "")
    ).strip()


    if not name:

        return jsonify({
            "success": False,
            "message": "Album name is required."
        }), 400


    album = Album(

        user_id=user.id,

        name=name,

        description=description
    )


    db.session.add(album)
    db.session.commit()


    return jsonify({
        "success": True,
        "album": {
            "id": album.id,
            "name": album.name,
            "description": album.description
        }
    })


# =========================================================
# AI COMPANION
# =========================================================

@app.route("/api/ai", methods=["POST"])
@login_required
def ai():

    user = current_user()


    data = request.get_json(
        silent=True
    ) or {}


    question = str(
        data.get("question", "")
    ).strip().lower()


    memories = Memory.query.filter_by(
        user_id=user.id
    ).all()


    count = len(memories)


    if "how many" in question:

        answer = (
            f"You currently have "
            f"{count} memories in your galaxy. ✨"
        )

    elif "oldest" in question and memories:

        oldest = min(
            memories,
            key=lambda m: m.date
        )

        answer = (
            f"Your oldest memory is "
            f"“{oldest.title}” "
            f"from {oldest.date.strftime('%d %b %Y')}. 🌌"
        )

    elif "latest" in question or "recent" in question:

        if memories:

            latest = max(
                memories,
                key=lambda m: m.date
            )

            answer = (
                f"Your most recent memory is "
                f"“{latest.title}” "
                f"from {latest.date.strftime('%d %b %Y')}. ✨"
            )

        else:

            answer = (
                "You don't have any memories yet. 🌌"
            )

    else:

        answer = (
            f"I found {count} memories in your "
            f"universe. I'm connected to your "
            f"MilkyMemory database now. 🌌"
        )


    return jsonify({
        "success": True,
        "answer": answer
    })


# =========================================================
# DATABASE INITIALIZATION
# =========================================================

with app.app_context():

    db.create_all()


# =========================================================
# RUN
# =========================================================

if __name__ == "__main__":

    print()
    print("=" * 55)
    print("           MILKYMEMORY")
    print("=" * 55)
    print("Server: http://127.0.0.1:5000")
    print("Database:", DB_NAME)
    print("=" * 55)
    print()

    app.run(
        host="127.0.0.1",
        port=5000,
        debug=True
    )